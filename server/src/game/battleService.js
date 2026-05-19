const { User, CharacterSkill, Inventory, BattleLog } = require('../models');
const { getMonstersInRoom, getSkill, getItem } = require('../game');
const { v4: uuidv4 } = require('uuid');
const roomDropsService = require('./roomDropsService');

class BattleService {
  constructor(io, redis) {
    this.io = io;
    this.redis = redis;
    this.activeBattles = new Map();  // 存储进行中的战斗
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  rollRange(range, fallback = 0) {
    if (!Array.isArray(range) || range.length !== 2) {
      return fallback;
    }

    const [min, max] = range;
    if (typeof min !== 'number' || typeof max !== 'number') {
      return fallback;
    }

    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  buildSkillPayload(skillId, level = 1) {
    const config = getSkill(skillId);
    if (!config) return null;

    return {
      id: skillId,
      name: config.name || '未知技能',
      level,
      type: config.type || 'attack',
      description: config.description || '',
      damageRange: config.damage || null,
      healRange: config.heal || null,
      buff: config.buff || null,
      debuff: config.debuff || null,
      poisonDamage: config.poisonDamage || 0,
      poisonDuration: config.poisonDuration || 0,
      burnDamage: config.burnDamage || 0,
      burnDuration: config.burnDuration || 0,
      dotDamage: config.dotDamage || 0,
      dotDuration: config.dotDuration || 0,
      stunChance: config.stunChance || 0,
      stunDuration: config.stunDuration || 1,
      freezeChance: config.freezeChance || 0,
      freezeDuration: config.freezeDuration || 1,
      fearChance: config.fearChance || 0,
      fearDuration: config.fearDuration || 1,
      healPercent: config.healPercent || 0,
      hpCost: config.hpCost || 0,
      reflectChance: config.reflectChance || 0,
      mpCost: config.mpCost || 0,
      cooldown: config.cooldown || 0,
      counterChance: config.counterChance || 0,
      mpRegen: config.mpRegen || 0,
      hpRegen: config.hpRegen || 0,
      dodgeChance: config.dodgeChance || 0,
      mpSteal: config.mpSteal || 0,
      healBonus: config.healBonus || 0,
      attackBonus: config.attackBonus || 0
    };
  }

  getMonsterSkills(skillIds = []) {
    return skillIds
      .map(skillId => this.buildSkillPayload(skillId))
      .filter(Boolean);
  }

  // 应用被动技能（战斗开始时自动激活持久buff和mpRegen）
  // 同时检查所有已学技能的counterChance
  applyPassiveSkills(participant) {
    participant._passiveHealBonus = 0;

    for (const skill of participant.skills || []) {
      if (!skill) continue;

      // 被动技能：buff效果、mpRegen、hpRegen、attackBonus
      if (skill.type === 'passive') {
        // 被动buff效果（如易筋经提升体质）
        if (skill.buff) {
          const effect = this.createModifierEffect(skill.name, 'passive_buff', skill.buff, 999);
          effect.tick = 'start';
          effect.duration = 999;
          if (skill.mpRegen) effect.mpRegen = skill.mpRegen;
          if (skill.hpRegen) effect.hpRegen = skill.hpRegen;
          participant.statusEffects.push(effect);
          this.recalculateParticipantState(participant);
        }

        // 被动技能只有再生没有buff（如冥想、洗髓经）
        if (!skill.buff && (skill.mpRegen || skill.hpRegen)) {
          participant.statusEffects.push({
            type: 'passive_regen',
            name: skill.name,
            duration: 999,
            tick: 'start',
            mpRegen: skill.mpRegen || 0,
            hpRegen: skill.hpRegen || 0,
            modifiers: {}
          });
        }

        // 被动攻击加成（如丐帮心法）
        if (skill.attackBonus && !skill.buff) {
          participant.statusEffects.push({
            type: 'passive_attack',
            name: skill.name,
            duration: 999,
            tick: 'start',
            modifiers: { attack: skill.attackBonus }
          });
          this.recalculateParticipantState(participant);
        }

        // 被动治疗加成（如峨眉心法）
        if (skill.healBonus) {
          participant._passiveHealBonus = (participant._passiveHealBonus || 0) + skill.healBonus;
        }
      }

      // 反击概率（任何技能有counterChance都生效，如太极拳）
      if (skill.counterChance) {
        participant.counterChance = Math.max(participant.counterChance || 0, skill.counterChance);
      }
    }
  }

  initializeParticipantState(participant) {
    participant.baseAttack = participant.attack || 0;
    participant.baseDefense = participant.defense || 0;
    participant.baseDodge = participant.dodge || 0;
    participant.baseDexterity = participant.dexterity || 0;
    participant.statusEffects = [];
    participant.statusSummary = [];
    participant.reflectDamage = 0;
    participant.defending = false;
    participant.counterChance = 0; // 反击概率
    this.recalculateParticipantState(participant);
    // 战斗开始时激活被动技能
    this.applyPassiveSkills(participant);
    return participant;
  }

  recalculateParticipantState(participant) {
    const modifiers = {
      attack: 0,
      defense: 0,
      dodge: 0,
      dexterity: 0,
      reflectDamage: 0
    };

    for (const effect of participant.statusEffects || []) {
      const effectModifiers = effect.modifiers || {};
      for (const [key, value] of Object.entries(effectModifiers)) {
        modifiers[key] = (modifiers[key] || 0) + value;
      }
    }

    participant.attack = Math.max(0, (participant.baseAttack || 0) + (modifiers.attack || 0));
    participant.defense = Math.max(0, (participant.baseDefense || 0) + (modifiers.defense || 0));
    participant.dexterity = Math.max(1, (participant.baseDexterity || 0) + (modifiers.dexterity || 0));
    participant.dodge = Math.max(0, (participant.baseDodge || 0) + (modifiers.dodge || 0) + Math.floor((modifiers.dexterity || 0) / 2));
    participant.reflectDamage = Math.max(0, modifiers.reflectDamage || 0);
    participant.statusSummary = (participant.statusEffects || []).map(effect => ({
      type: effect.type,
      name: effect.name,
      duration: effect.duration
    }));
  }

  removeExpiredEffects(participant) {
    participant.statusEffects = (participant.statusEffects || []).filter(effect => effect.duration > 0);
    this.recalculateParticipantState(participant);
  }

  createModifierEffect(name, type, rawModifiers = {}, fallbackDuration = 1) {
    const { duration, ...effectModifiers } = rawModifiers || {};
    const modifiers = {};

    for (const [key, value] of Object.entries(effectModifiers)) {
      if (typeof value === 'number') {
        modifiers[key] = value;
      }
    }

    return {
      type,
      name,
      duration: duration || fallbackDuration,
      tick: 'end',
      modifiers
    };
  }

  addEffect(target, effect, result) {
    if (!effect) return;

    target.statusEffects.push(effect);
    this.recalculateParticipantState(target);
    if (result) {
      result.effectMessages = result.effectMessages || [];
      result.effectMessages.push(`${target.name} 受到状态「${effect.name}」影响，持续 ${effect.duration} 回合。`);
    }
  }

  applyChanceEffect(target, chance, effectFactory, result) {
    if (!chance || chance <= 0) return false;
    if (Math.random() >= chance) return false;

    const effect = effectFactory();
    this.addEffect(target, effect, result);
    return true;
  }

  processStartOfTurnEffects(participant, result) {
    let skipped = false;

    for (const effect of participant.statusEffects || []) {
      if (effect.tick !== 'start') {
        continue;
      }

      if (effect.damagePerTurn > 0) {
        participant.hp = Math.max(0, participant.hp - effect.damagePerTurn);
        result.effectMessages = result.effectMessages || [];
        result.effectMessages.push(`${participant.name} 受到「${effect.name}」影响，损失 ${effect.damagePerTurn} 点HP。`);
      }

      // 被动技能：MP回复（如冥想）
      if (effect.mpRegen > 0) {
        participant.mp = Math.min((participant.maxMp || participant.mp || 0), (participant.mp || 0) + effect.mpRegen);
        result.effectMessages = result.effectMessages || [];
        result.effectMessages.push(`${participant.name} 的「${effect.name}」生效，恢复了 ${effect.mpRegen} 点MP。`);
      }

      // 被动技能：HP回复（如洗髓经）
      if (effect.hpRegen > 0) {
        participant.hp = Math.min((participant.maxHp || participant.hp || 0), (participant.hp || 0) + effect.hpRegen);
        result.effectMessages = result.effectMessages || [];
        result.effectMessages.push(`${participant.name} 的「${effect.name}」生效，恢复了 ${effect.hpRegen} 点HP。`);
      }

      if (effect.skipTurn && !skipped) {
        skipped = true;
        result.effectMessages = result.effectMessages || [];
        result.effectMessages.push(`${participant.name} 因「${effect.name}」无法行动。`);
      }

      // 持久被动效果（duration=999）不减少持续时间
      if (effect.duration !== 999) {
        effect.duration -= 1;
      }
    }

    this.removeExpiredEffects(participant);
    return { skipped };
  }

  processEndOfTurnEffects(participant) {
    for (const effect of participant.statusEffects || []) {
      if (effect.tick === 'end') {
        // 持久被动效果（duration=999）不减少持续时间
        if (effect.duration !== 999) {
          effect.duration -= 1;
        }
      }
    }

    this.removeExpiredEffects(participant);
  }

  applyReflectDamage(defender, attacker, result) {
    if (!defender.reflectDamage || defender.reflectDamage <= 0) {
      return 0;
    }

    attacker.hp = Math.max(0, attacker.hp - defender.reflectDamage);
    result.effectMessages = result.effectMessages || [];
    result.effectMessages.push(`${defender.name} 的反伤生效，${attacker.name} 受到 ${defender.reflectDamage} 点反伤。`);
    return defender.reflectDamage;
  }

  // 反击机制：被攻击方有一定概率反击攻击者
  applyCounterAttack(defender, attacker, originalDamage, result) {
    const counterChance = defender.counterChance || 0;
    if (counterChance <= 0 || defender.hp <= 0) {
      return 0;
    }

    if (Math.random() >= counterChance) {
      return 0;
    }

    // 反击伤害为原始伤害的30%
    const counterDamage = Math.max(1, Math.floor(originalDamage * 0.3));
    attacker.hp = Math.max(0, attacker.hp - counterDamage);
    result.effectMessages = result.effectMessages || [];
    result.effectMessages.push(`${defender.name} 发动反击！${attacker.name} 受到 ${counterDamage} 点反击伤害。`);
    return counterDamage;
  }

  applyAttackSkillSideEffects(skill, attacker, defender, dealtDamage, result) {
    if (skill.healPercent > 0 && dealtDamage > 0) {
      const healed = Math.max(1, Math.floor(dealtDamage * skill.healPercent));
      attacker.hp = this.clamp(attacker.hp + healed, 0, attacker.maxHp);
      result.effectMessages = result.effectMessages || [];
      result.effectMessages.push(`${attacker.name} 从 ${skill.name} 中吸取了 ${healed} 点HP。`);
    }

    // MP吸取（如北冥神功）
    if (skill.mpSteal > 0 && dealtDamage > 0) {
      const stolen = Math.min(defender.mp || 0, skill.mpSteal);
      if (stolen > 0) {
        defender.mp = Math.max(0, (defender.mp || 0) - stolen);
        attacker.mp = Math.min((attacker.maxMp || attacker.mp || 0), (attacker.mp || 0) + stolen);
        result.effectMessages = result.effectMessages || [];
        result.effectMessages.push(`${attacker.name} 从 ${skill.name} 中吸取了 ${stolen} 点MP。`);
      }
    }

    // 闪避提升buff（如醉拳的dodgeChance会临时提升闪避）
    if (skill.dodgeChance > 0) {
      attacker.dodge = (attacker.dodge || 0) + Math.floor(skill.dodgeChance * 100);
      result.effectMessages = result.effectMessages || [];
      result.effectMessages.push(`${attacker.name} 身形飘忽，闪避提升！`);
    }

    if (skill.poisonDamage > 0 && skill.poisonDuration > 0) {
      this.addEffect(defender, {
        type: 'poison',
        name: '中毒',
        duration: skill.poisonDuration,
        tick: 'start',
        damagePerTurn: skill.poisonDamage
      }, result);
    }

    if (skill.burnDamage > 0 && skill.burnDuration > 0) {
      this.addEffect(defender, {
        type: 'burn',
        name: '灼烧',
        duration: skill.burnDuration,
        tick: 'start',
        damagePerTurn: skill.burnDamage
      }, result);
    }

    if (skill.dotDamage > 0 && skill.dotDuration > 0) {
      this.addEffect(defender, {
        type: 'dot',
        name: '持续伤害',
        duration: skill.dotDuration,
        tick: 'start',
        damagePerTurn: skill.dotDamage
      }, result);
    }

    this.applyChanceEffect(defender, skill.stunChance, () => ({
      type: 'stun',
      name: '眩晕',
      duration: skill.stunDuration || 1,
      tick: 'start',
      skipTurn: true
    }), result);

    this.applyChanceEffect(defender, skill.freezeChance, () => ({
      type: 'freeze',
      name: '冻结',
      duration: skill.freezeDuration || 1,
      tick: 'start',
      skipTurn: true
    }), result);

    this.applyChanceEffect(defender, skill.fearChance, () => ({
      type: 'fear',
      name: '恐惧',
      duration: skill.fearDuration || 1,
      tick: 'start',
      skipTurn: true
    }), result);
  }

  applySupportSkillEffects(skill, attacker, defender, result) {
    if (skill.buff) {
      this.addEffect(attacker, this.createModifierEffect(skill.name, 'buff', skill.buff), result);
    }

    if (skill.debuff) {
      this.addEffect(defender, this.createModifierEffect(skill.name, 'debuff', skill.debuff), result);
    }

    this.applyChanceEffect(defender, skill.freezeChance, () => ({
      type: 'freeze',
      name: '冻结',
      duration: skill.freezeDuration || 1,
      tick: 'start',
      skipTurn: true
    }), result);

    this.applyChanceEffect(defender, skill.stunChance, () => ({
      type: 'stun',
      name: '眩晕',
      duration: skill.stunDuration || 1,
      tick: 'start',
      skipTurn: true
    }), result);
  }

  async getCombatStats(user) {
    const equippedItems = await Inventory.find({
      userId: user._id,
      isEquipped: true
    });

    const bonuses = equippedItems.reduce((acc, item) => {
      const attributes = item.calculateAttributes();
      acc.attack += attributes.attack || 0;
      acc.defense += attributes.defense || 0;
      acc.dexterity += attributes.dexterity || 0;
      return acc;
    }, {
      attack: 0,
      defense: 0,
      dexterity: 0
    });

    const totalDexterity = user.attributes.dexterity + bonuses.dexterity;

    return {
      attack: user.calculateAttack() + bonuses.attack,
      defense: user.calculateDefense() + bonuses.defense,
      dodge: user.calculateDodge() + Math.floor(bonuses.dexterity / 2),
      dexterity: totalDexterity
    };
  }
  
  // 开始战斗
  async startBattle(userId, targetId, type = 'pve') {
    const user = await User.findById(userId);
    if (!user) throw new Error('玩家不存在');
    
    if (user.status === 'fighting') {
      throw new Error('你正在战斗中');
    }
    
    if (user.hp.current <= 0) {
      throw new Error('你已死亡，无法战斗');
    }
    
    const battleId = uuidv4();
    const playerStats = await this.getCombatStats(user);
    const battle = {
      battleId,
      type,
      participants: [],
      currentRound: 0,
      turnOrder: [],
      status: 'active',
      rounds: [],
      startedAt: new Date()
    };
    
    // 添加玩家
    battle.participants.push(this.initializeParticipantState({
      userId: user._id,
      name: user.characterName,
      level: user.level,
      hp: user.hp.current,
      maxHp: user.hp.max,
      mp: user.mp.current,
      maxMp: user.mp.max,
      attack: playerStats.attack,
      defense: playerStats.defense,
      dodge: playerStats.dodge,
      dexterity: playerStats.dexterity,
      skills: await this.getPlayerSkills(userId)
    }));
    
    // 添加目标
    if (type === 'pve') {
      const monster = getMonstersInRoom(user.location.roomId).find(m => m.id === targetId);
      if (!monster) throw new Error('怪物不存在');
      
      battle.monster = {
        id: monster.id,
        name: monster.name,
        level: monster.level,
        hp: monster.hp,
        maxHp: monster.hp,
        mp: monster.mp || 0,
        attack: monster.attack,
        defense: monster.defense,
        skills: this.getMonsterSkills(monster.skills || []),
        exp: monster.exp || 0,
        gold: monster.gold || 0,
        drops: monster.drops || []
      };
      
      battle.participants.push(this.initializeParticipantState({
        id: monster.id,
        name: monster.name,
        level: monster.level,
        hp: monster.hp,
        maxHp: monster.hp,
        mp: monster.mp || 0,
        maxMp: monster.mp || 0,
        attack: monster.attack,
        defense: monster.defense,
        dodge: monster.dodge || 0,
        dexterity: monster.dexterity || monster.level || 0,
        skills: this.getMonsterSkills(monster.skills || []),
        isMonster: true
      }));
    } else if (type === 'pvp') {
      const opponent = await User.findById(targetId);
      if (!opponent) throw new Error('对手不存在');
      if (opponent.status === 'fighting') throw new Error('对手正在战斗中');
      if (opponent.status === 'dead') throw new Error('对手已死亡，无法应战');
      if (opponent.hp.current <= 0) throw new Error('对手生命值不足，无法应战');
      if (this.isInBattle(opponent._id)) throw new Error('对手已在另一场战斗中');

      const opponentStats = await this.getCombatStats(opponent);
      
      battle.participants.push(this.initializeParticipantState({
        userId: opponent._id,
        name: opponent.characterName,
        level: opponent.level,
        hp: opponent.hp.current,
        maxHp: opponent.hp.max,
        mp: opponent.mp.current,
        maxMp: opponent.mp.max,
        attack: opponentStats.attack,
        defense: opponentStats.defense,
        dodge: opponentStats.dodge,
        dexterity: opponentStats.dexterity,
        skills: await this.getPlayerSkills(targetId)
      }));
    }
    
    // 确定行动顺序
    battle.turnOrder = [...battle.participants].sort((a, b) => (b.dexterity || 0) - (a.dexterity || 0));
    battle.currentTurn = 0;
    
    // 存储战斗
    this.activeBattles.set(battleId, battle);
    
    // 更新玩家状态
    user.status = 'fighting';
    await user.save();
    
    return battle;
  }
  
  // 获取玩家技能
  async getPlayerSkills(userId) {
    const skills = await CharacterSkill.find({ userId, learned: true });
    return skills.map(skill => {
      return this.buildSkillPayload(skill.skillId, skill.level);
    }).filter(Boolean);
  }

  getBattle(battleId) {
    return this.activeBattles.get(battleId);
  }

  getCurrentParticipant(battleId) {
    const battle = this.getBattle(battleId);
    if (!battle) return null;
    return battle.turnOrder[battle.currentTurn] || null;
  }

  getPlayerParticipant(battle, userId) {
    return battle.participants.find(p => p.userId?.toString() === userId.toString());
  }

  reduceDamageForDefense(defender, damage) {
    if (!defender.defending) {
      return damage;
    }

    defender.defending = false;
    return Math.max(1, Math.floor(damage * 0.5));
  }

  chooseAutomatedAction(battleId) {
    const attacker = this.getCurrentParticipant(battleId);
    if (!attacker) {
      return { action: 'attack', skillId: null };
    }

    const skills = (attacker.skills || []).filter(skill => {
      if (!skill) return false;
      if ((skill.mpCost || 0) > (attacker.mp || 0)) return false;
      return ['attack', 'heal', 'buff', 'debuff', 'defense'].includes(skill.type);
    });

    const healSkill = skills.find(skill =>
      skill.type === 'heal' &&
      Array.isArray(skill.healRange) &&
      attacker.hp < attacker.maxHp * 0.45
    );
    if (healSkill) {
      return { action: 'skill', skillId: healSkill.id };
    }

    const buffSkill = skills.find(skill => skill.type === 'buff' || skill.type === 'defense');
    if (buffSkill && attacker.statusEffects.filter(effect => effect.type === 'buff').length === 0 && Math.random() < 0.35) {
      return { action: 'skill', skillId: buffSkill.id };
    }

    const debuffSkill = skills.find(skill => skill.type === 'debuff');
    if (debuffSkill && Math.random() < 0.3) {
      return { action: 'skill', skillId: debuffSkill.id };
    }

    const attackSkills = skills.filter(skill => skill.type === 'attack');
    if (attackSkills.length > 0 && Math.random() < 0.65) {
      const selected = attackSkills[Math.floor(Math.random() * attackSkills.length)];
      return { action: 'skill', skillId: selected.id };
    }

    return { action: 'attack', skillId: null };
  }
  
  // 执行战斗回合
  async executeTurn(battleId, action, skillId = null) {
    const battle = this.activeBattles.get(battleId);
    if (!battle) throw new Error('战斗不存在');
    
    if (battle.status !== 'active') {
      throw new Error('战斗已结束');
    }
    
    const attacker = battle.turnOrder[battle.currentTurn];
    const defender = battle.participants.find(p => p !== attacker);
    
    let result = {
      round: battle.currentRound,
      attacker: attacker.name,
      defender: defender.name,
      action: action,
      damage: 0,
      remainingHp: defender.hp,
      remainingMp: attacker.mp,
      effectMessages: [],
      timestamp: new Date()
    };

    const startState = this.processStartOfTurnEffects(attacker, result);
    result.remainingMp = attacker.mp;

    if (attacker.hp <= 0) {
      result.defeatedByStatus = true;
      result.remainingHp = 0;
    } else if (startState.skipped) {
      result.skipped = true;
      result.remainingHp = attacker.hp;
    }
    
    if (attacker.hp <= 0) {
      battle.status = 'ended';
      battle.winner = defender;
      battle.loser = attacker;
    } else if (!startState.skipped && action === 'attack') {
      // 普通攻击
      const baseDamage = attacker.attack - defender.defense;
      const variance = Math.random() * 0.2 - 0.1;  // ±10%波动
      let damage = Math.max(1, Math.floor(baseDamage * (1 + variance)));
      
      // 闪避判定
      const dodgeChance = defender.dodge / 100;
      if (Math.random() < dodgeChance) {
        result.dodged = true;
        result.damage = 0;
      } else {
        damage = this.reduceDamageForDefense(defender, damage);
        defender.hp = Math.max(0, defender.hp - damage);
        result.damage = damage;
        result.remainingHp = defender.hp;
        result.reflectedDamage = this.applyReflectDamage(defender, attacker, result);
        // 反击判定
        result.counterDamage = this.applyCounterAttack(defender, attacker, damage, result);
      }
    } else if (!startState.skipped && action === 'skill' && skillId) {
      // 使用技能
      const skill = attacker.skills?.find(s => s.id === skillId);
      if (!skill) throw new Error('技能不存在');

      // 检查冷却
      if (skill.cooldown > 0 && skill.lastUsedRound != null) {
        const roundsSince = battle.currentRound - skill.lastUsedRound;
        if (roundsSince < skill.cooldown) {
          throw new Error(`${skill.name} 冷却中（剩余 ${skill.cooldown - roundsSince} 回合）`);
        }
      }

      const mpCost = skill.mpCost || 0;
      if ((attacker.mp || 0) < mpCost) {
        throw new Error('MP不足');
      }

      if (skill.hpCost > 0 && attacker.hp <= skill.hpCost) {
        throw new Error('HP不足，无法施展该技能');
      }
      
      attacker.mp -= mpCost;
      if (skill.hpCost > 0) {
        attacker.hp = Math.max(1, attacker.hp - skill.hpCost);
        result.hpCost = skill.hpCost;
        result.effectMessages.push(`${attacker.name} 施展 ${skill.name} 消耗了 ${skill.hpCost} 点HP。`);
      }
      result.skill = skill.name;
      result.skillType = skill.type;
      result.mpCost = mpCost;
      result.remainingMp = attacker.mp;

      if (skill.type === 'heal') {
        let healAmount = this.rollRange(skill.healRange, Math.max(10, Math.floor(attacker.attack * 0.5)));
        // 被动治疗加成（如峨眉心法）
        if (attacker._passiveHealBonus > 0) {
          healAmount = Math.floor(healAmount * (1 + attacker._passiveHealBonus));
        }
        attacker.hp = this.clamp(attacker.hp + healAmount, 0, attacker.maxHp);
        result.healed = healAmount;
        result.defender = attacker.name;
        result.remainingHp = attacker.hp;
      } else if (skill.type === 'attack') {
        let damage = this.rollRange(skill.damageRange, attacker.attack);
        damage = this.reduceDamageForDefense(defender, damage);
        defender.hp = Math.max(0, defender.hp - damage);
        result.damage = damage;
        result.remainingHp = Math.max(0, defender.hp);
        this.applyAttackSkillSideEffects(skill, attacker, defender, damage, result);
        result.reflectedDamage = this.applyReflectDamage(defender, attacker, result);
        // 反击判定
        result.counterDamage = this.applyCounterAttack(defender, attacker, damage, result);
      } else if (skill.type === 'buff' || skill.type === 'debuff' || skill.type === 'defense') {
        this.applySupportSkillEffects(skill, attacker, defender, result);
        if (skill.type === 'defense' && !skill.buff) {
          attacker.defending = true;
          result.defending = true;
        }
        result.remainingHp = defender.hp;
      } else {
        throw new Error('该技能暂不支持战斗中使用');
      }
      // 记录技能冷却
      skill.lastUsedRound = battle.currentRound;
    } else if (!startState.skipped && action === 'defend') {
      // 防御（减少下一回合受到的伤害）
      attacker.defending = true;
      result.defending = true;
      result.remainingMp = attacker.mp;
    } else if (!startState.skipped && action === 'flee') {
      // 逃跑
      const fleeChance = 0.3 + attacker.dexterity / 100;
      if (Math.random() < fleeChance) {
        battle.status = 'fled';
        result.fled = true;
      } else {
        result.fled = false;
        result.message = '逃跑失败';
      }
      result.remainingMp = attacker.mp;
    }

    this.processEndOfTurnEffects(attacker);
    
    // 记录回合
    battle.rounds.push(result);
    
    // 检查战斗结束
    let endResult = null;
    if (attacker.hp <= 0 && defender.hp <= 0) {
      battle.status = 'ended';
      battle.winner = null;
      battle.loser = null;
      result.mutualDefeat = true;
      endResult = await this.endBattle(battleId);
    } else if (attacker.hp <= 0) {
      battle.status = 'ended';
      battle.winner = defender;
      battle.loser = attacker;
      endResult = await this.endBattle(battleId);
    } else if (defender.hp <= 0) {
      battle.status = 'ended';
      battle.winner = attacker;
      battle.loser = defender;
      endResult = await this.endBattle(battleId);
    } else if (battle.status === 'fled') {
      endResult = await this.endBattle(battleId);
    } else {
      // 下一回合
      battle.currentTurn = (battle.currentTurn + 1) % battle.turnOrder.length;
      if (battle.currentTurn === 0) {
        battle.currentRound++;
      }
    }
    
    return {
      battle,
      result,
      rewards: endResult?.rewards
    };
  }
  
  // 结束战斗
  async endBattle(battleId) {
    const battle = this.activeBattles.get(battleId);
    if (!battle) return;
    
    const player = battle.participants.find(p => p.userId);
    const user = await User.findById(player.userId);
    
    // 记录战斗日志
    const battleLog = new BattleLog({
      battleId,
      type: battle.type,
      participants: battle.participants.map(p => ({
        userId: p.userId,
        name: p.name,
        level: p.level,
        hp: p.hp,
        maxHp: p.maxHp,
        isWinner: battle.winner?.userId === p.userId
      })),
      monster: battle.monster,
      rounds: battle.rounds,
      result: {
        winner: battle.winner?.name,
        expGained: 0,
        goldGained: 0,
        itemsDropped: []
      },
      endedAt: new Date(),
      duration: Math.floor((new Date() - battle.startedAt) / 1000)
    });
    
    // 计算奖励（如果玩家获胜）
    if (battle.winner?.userId && battle.type === 'pve') {
      const monster = battle.monster;
      const expGained = monster.exp || Math.floor(monster.level * 10 * (1 + Math.random() * 0.2));
      const goldGained = monster.gold || Math.floor(monster.level * 5 * (1 + Math.random() * 0.3));
      
      user.exp += expGained;
      user.gold += goldGained;
      
      // 检查升级
      if (user.canLevelUp()) {
        user.levelUp();
      }
      
      // 技能经验获取 - 战斗中使用的技能获得经验
      const usedSkillIds = [...new Set(
        battle.rounds
          .filter(r => r.action === 'skill' && r.skill)
          .map(r => {
            const skill = player.skills?.find(s => s.name === r.skill);
            return skill?.id;
          })
          .filter(Boolean)
      )];
      
      const skillExpResults = [];
      for (const skillId of usedSkillIds) {
        const charSkill = await CharacterSkill.findOne({ userId: user._id, skillId });
        if (charSkill && charSkill.level < 10) {
          const skillExp = Math.floor(10 + monster.level * 2 + Math.random() * 5);
          charSkill.exp += skillExp;
          charSkill.lastUsedAt = new Date();
          
          const leveledUp = charSkill.canLevelUp();
          if (leveledUp) {
            charSkill.levelUp();
          }
          await charSkill.save();
          
          skillExpResults.push({
            skillId,
            skillName: charSkill.getSkillConfig()?.name || skillId,
            expGained: skillExp,
            leveledUp,
            newLevel: charSkill.level
          });
        }
      }
      battleLog.result.skillExp = skillExpResults;
      
      battleLog.result.expGained = expGained;
      battleLog.result.goldGained = goldGained;
      
      // 物品掉落 - 直接进入玩家背包 + 同时放到房间地面
      const droppedItems = (monster.drops || []).filter(drop => Math.random() < (drop.rate || 0));
      const droppedItemNames = [];
      const autoLootItems = [];
      for (const drop of droppedItems) {
        const itemConfig = getItem(drop.itemId);
        const itemName = itemConfig ? itemConfig.name : drop.itemId;
        const qty = drop.quantity || 1;
        roomDropsService.addDrop(user.location.roomId, drop.itemId, itemName, qty, monster.name);
        battleLog.result.itemsDropped.push(drop.itemId);
        droppedItemNames.push(`${itemName}×${qty}`);
        // 自动拾取到玩家背包
        const isEquip = itemConfig && (itemConfig.type === 'weapon' || itemConfig.type === 'armor' || itemConfig.type === 'equipment');
        autoLootItems.push({ itemId: drop.itemId, itemName, quantity: qty, isEquipment: isEquip });
      }
      battleLog.result.droppedItemNames = droppedItemNames;
      battleLog.result.dropRoomId = user.location.roomId;
      // 自动放入背包
      for (const loot of autoLootItems) {
        const existing = await Inventory.findOne({ userId: user._id, itemId: loot.itemId, isEquipped: false });
        if (existing && !loot.isEquipment) {
          existing.quantity += loot.quantity;
          await existing.save();
        } else {
          await Inventory.create({ userId: user._id, itemId: loot.itemId, quantity: loot.quantity,
            durability: loot.isEquipment ? { current: 100, max: 100 } : undefined });
        }
      }
      battleLog.result.autoLooted = autoLootItems.map(l => `${l.itemName}×${l.quantity}`);
    }
    
    // 如果玩家死亡
    if (player.hp <= 0 || battle.loser?.userId === player.userId) {
      user.hp.current = 0;
      user.status = 'dead';
      // 死亡统计
      if (!user.stats) user.stats = {};
      user.stats.deaths = (user.stats.deaths || 0) + 1;
      // 应用死亡惩罚
      const penalty = user.applyDeathPenalty();
      battleLog.result.deathPenalty = penalty;
      // 死亡时装备耐久额外损失
      const equippedItems = await Inventory.find({ userId: user._id, isEquipped: true });
      for (const item of equippedItems) {
        item.useDurability(10); // 死亡额外扣10点耐久
        await item.save();
      }
    } else {
      user.hp.current = player.hp;
      user.mp.current = player.mp;
      user.status = 'online';
      // 战斗消耗装备耐久
      const equippedItems = await Inventory.find({ userId: user._id, isEquipped: true });
      for (const item of equippedItems) {
        item.useDurability(Math.floor(Math.random() * 3) + 1); // 每场战斗1-3点磨损
        await item.save();
      }
    }
    
    await user.save();
    await battleLog.save();
    
    // 移除战斗
    this.activeBattles.delete(battleId);
    
    return {
      battleLog,
      rewards: battleLog.result
    };
  }
  
  // 玩家是否在战斗中
  isInBattle(userId) {
    for (const battle of this.activeBattles.values()) {
      if (battle.participants.some(p => p.userId?.toString() === userId.toString())) {
        return battle.battleId;
      }
    }
    return null;
  }
}

module.exports = BattleService;
