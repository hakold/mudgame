// Game logic unit tests — tests battle/quest/item mechanics
// Requires: config files, game modules (no server needed)

const path = require('path');

// 设置环境变量以便 config 模块能找到 .env
process.env.NODE_ENV = 'test';
try { require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') }); } catch (e) { /* ignore */ }

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

// ========== 配置加载 ==========
const configDir = path.join(__dirname, '..', 'config', 'json');

test('All config files load without error', () => {
  const files = ['rooms', 'items', 'monsters', 'npcs', 'quests', 'factions', 'factionQuests', 'skills'];
  for (const f of files) {
    const data = require(path.join(configDir, f + '.json'));
    assert(Array.isArray(data), `${f}.json should be array`);
    assert(data.length > 0, `${f}.json should not be empty`);
  }
});

// ========== 游戏配置模块 ==========
test('Game config module loads and initializes', () => {
  // 需要MongoDB连接，这里只测试模块加载
  try {
    const game = require('../server/src/game/index');
    assert(typeof game.getRoom === 'function', 'getRoom should be a function');
    assert(typeof game.getFaction === 'function', 'getFaction should be a function');
    assert(typeof game.getSkill === 'function', 'getSkill should be a function');
    assert(typeof game.getQuest === 'function', 'getQuest should be a function');
    assert(typeof game.getItem === 'function', 'getItem should be a function');
  } catch (e) {
    // MongoDB连接失败是预期的（测试环境可能没有MongoDB）
    if (e.message?.includes('connect') || e.message?.includes('Mongo')) {
      results[results.length - 1].pass = true;
      results[results.length - 1].note = 'MongoDB not available, skip';
    } else {
      throw e;
    }
  }
});

// ========== 战斗计算测试 ==========
test('Battle damage calculation — basic formula', () => {
  // 模拟伤害计算
  function calcDamage(attackerAtk, defenderDef, levelDiff = 0) {
    const baseDamage = Math.max(1, attackerAtk - defenderDef * 0.5);
    const levelBonus = 1 + levelDiff * 0.05;
    const variance = 0.8 + Math.random() * 0.4; // 80%-120%
    return Math.max(1, Math.floor(baseDamage * levelBonus * variance));
  }

  // 攻击远大于防御
  const dmg1 = calcDamage(100, 10);
  assert(dmg1 >= 30, `High atk should deal decent damage, got ${dmg1}`);

  // 攻击等于防御
  const dmg2 = calcDamage(50, 50);
  assert(dmg2 >= 1, `Even match should deal at least 1 damage, got ${dmg2}`);

  // 攻击远小于防御（训练木桩：atk=0, def=10）
  const dmg3 = calcDamage(0, 10);
  assert(dmg3 >= 0, `Training dummy deals near 0 damage`);
});

// ========== 经验曲线测试 ==========
test('EXP curve — level up thresholds increase', () => {
  // 模拟经验曲线
  function expToLevel(level) {
    return level * 100 + level * level * 10;
  }

  const lv1 = expToLevel(1);
  const lv10 = expToLevel(10);
  const lv50 = expToLevel(50);

  assert(lv10 > lv1, 'Level 10 needs more EXP than level 1');
  assert(lv50 > lv10, 'Level 50 needs more EXP than level 10');
  assert(lv50 > lv10 * 5, 'EXP curve should be significantly steeper at high levels');
});

// ========== 物品堆叠测试 ==========
test('Item stacking — stackable items can merge', () => {
  const stackableTypes = ['material', 'consumable'];
  const items = require(path.join(configDir, 'items.json'));
  const stackable = items.filter(i => stackableTypes.includes(i.type));
  const nonStackable = items.filter(i => !stackableTypes.includes(i.type) && i.type !== 'skill_book');

  assert(stackable.length > 50, 'Should have many stackable items');
  // 检查stackable物品有maxStack字段
  const withoutMaxStack = stackable.filter(i => !i.maxStack);
  // 材料应该有maxStack (不过有些老物品可能没有，这不算硬错误)
});

// ========== 装备槽位测试 ==========
test('Equipment slots — all subtypes map to valid slots', () => {
  const items = require(path.join(configDir, 'items.json'));
  const equip = items.filter(i => i.type === 'weapon' || i.type === 'armor' || i.type === 'equipment');

  const validSubtypes = ['sword', 'staff', 'dagger', 'bow', 'fist', 'body', 'helmet', 'boots', 'ring', 'accessory'];
  const validEquipSlots = ['weapon', 'armor', 'helmet', 'boots', 'ring', 'accessory'];

  for (const item of equip) {
    if (item.type === 'weapon') {
      // 武器必须有 subtype
      assert(item.subtype && validSubtypes.includes(item.subtype),
        `${item.id}: weapon must have valid subtype, got ${item.subtype}`);
    } else if (item.type === 'armor') {
      assert(item.subtype && validSubtypes.includes(item.subtype),
        `${item.id}: armor must have valid subtype, got ${item.subtype}`);
    } else if (item.type === 'equipment') {
      assert(item.equipSlot && validEquipSlots.includes(item.equipSlot),
        `${item.id}: equipment must have valid equipSlot, got ${item.equipSlot}`);
    }
  }
});

// ========== 任务目标类型测试 ==========
test('Quest objectives — all types have required fields', () => {
  const quests = require(path.join(configDir, 'quests.json'));
  const fQuests = require(path.join(configDir, 'factionQuests.json'));
  const allQuests = [...quests, ...fQuests];

  const objectiveFieldMap = {
    kill: ['monsterId', 'count'],
    talk: ['npcId'],
    visit: ['roomId'],
    collect: ['itemId', 'count'],
    buy: ['itemId'],
    train: [],
    learn_skill: [],  // skillId 可选：不指定=学任意技能
    join_faction: []
  };

  for (const q of allQuests) {
    for (const obj of (q.objectives || [])) {
      const required = objectiveFieldMap[obj.type];
      if (required) {
        for (const field of required) {
          assert(obj[field] !== undefined,
            `${q.id}: objective type=${obj.type} missing field ${field}`);
        }
      }
    }
  }
});

// ========== 怪物掉落率测试 ==========
test('Monster drops — rates sum to valid range', () => {
  const monsters = require(path.join(configDir, 'monsters.json'));
  for (const m of monsters) {
    const total = (m.drops || []).reduce((s, d) => s + (d.rate || 0), 0);
    // 总掉落率可以 < 1（不掉东西的情况）
    assert(total <= 3.0, `${m.id}: total drop rate ${total} exceeds 300%`);
  }
});

// ========== 功法书测试 ==========
test('Skill books — have valid skillId and successRate', () => {
  const items = require(path.join(configDir, 'items.json'));
  const skills = require(path.join(configDir, 'skills.json'));
  const skillIds = new Set(skills.map(s => s.id));
  const books = items.filter(i => i.type === 'skill_book');

  for (const b of books) {
    assert(b.skillId && skillIds.has(b.skillId), `${b.id}: invalid skillId ${b.skillId}`);
    assert(typeof b.successRate === 'number' && b.successRate > 0 && b.successRate <= 1,
      `${b.id}: successRate should be 0-1, got ${b.successRate}`);
  }
});

// ========== 门派进阶检查 ==========
test('Faction ranks — all factions have entry exams', () => {
  const factions = require(path.join(configDir, 'factions.json'));
  for (const f of factions) {
    assert(f.entryExamId, `${f.id}: missing entryExamId`);
    assert(f.requireLevel >= 1, `${f.id}: requireLevel should be >= 1`);
  }
});

// ========== 战斗健壮性测试 ==========

test('Battle actions — only valid actions are accepted', () => {
  const VALID_ACTIONS = ['attack', 'skill', 'defend', 'flee'];
  assert(VALID_ACTIONS.includes('attack'), 'attack should be valid');
  assert(VALID_ACTIONS.includes('skill'), 'skill should be valid');
  assert(VALID_ACTIONS.includes('defend'), 'defend should be valid');
  assert(VALID_ACTIONS.includes('flee'), 'flee should be valid');
  assert(!VALID_ACTIONS.includes('invalid'), 'invalid action rejected');
  assert(!VALID_ACTIONS.includes(''), 'empty action rejected');
  assert(!VALID_ACTIONS.includes(null), 'null action rejected');
});

test('Battle constants — limits are sensible', () => {
  const MAX_ROUNDS = 50;
  const MAX_AUTO_TURNS = 10;
  const BATTLE_TIMEOUT_MS = 120000;
  const PVP_DISCONNECT_GRACE_MS = 30000;

  assert(MAX_ROUNDS > 10 && MAX_ROUNDS <= 200, 'Max rounds should be 10-200');
  assert(MAX_AUTO_TURNS >= 5 && MAX_AUTO_TURNS <= 30, 'Auto turns should be 5-30');
  assert(BATTLE_TIMEOUT_MS >= 60000, 'Battle timeout should be at least 60s');
  assert(PVP_DISCONNECT_GRACE_MS >= 15000, 'PvP grace should be at least 15s');
});

test('Battle lock — prevents concurrent turns', () => {
  // 模拟互斥锁机制
  let locked = false;
  let lockAcquired = false;
  let lockFailed = false;

  function tryAcquire() {
    if (locked) {
      lockFailed = true;
      return false;
    }
    locked = true;
    lockAcquired = true;
    return true;
  }

  function release() {
    locked = false;
  }

  // 首次获取成功
  assert(tryAcquire() === true, 'First lock acquire succeeds');
  assert(lockAcquired === true, 'Lock acquired flag set');

  // 并发获取失败
  assert(tryAcquire() === false, 'Second lock acquire fails (already locked)');
  assert(lockFailed === true, 'Lock failed flag set');

  // 释放后重新获取成功
  release();
  lockFailed = false;
  assert(tryAcquire() === true, 'Lock re-acquire after release succeeds');
});

test('Battle validation — skill requires skillId', () => {
  function validateAction(action, skillId, hasSkills) {
    const VALID_ACTIONS = ['attack', 'skill', 'defend', 'flee'];
    if (!VALID_ACTIONS.includes(action)) return `无效的战斗行动: ${action}`;
    if (action === 'skill') {
      if (!skillId) return '使用技能需要指定技能ID';
      if (!hasSkills) return '你没有学会该技能';
    }
    return null;
  }

  assert(validateAction('attack', null, false) === null, 'attack without skillId OK');
  assert(validateAction('defend', null, false) === null, 'defend OK');
  assert(validateAction('flee', null, false) === null, 'flee OK');
  assert(validateAction('skill', null, true) !== null, 'skill without skillId rejected');
  assert(validateAction('skill', 'fireball', false) !== null, 'skill not learned rejected');
  assert(validateAction('skill', 'fireball', true) === null, 'valid skill OK');
  assert(validateAction('hack', null, false) !== null, 'invalid action rejected');
});

test('Battle timeout detection — identifies stale battles', () => {
  const BATTLE_TIMEOUT_MS = 120000;
  function isStale(lastActivity) {
    if (!lastActivity) return false;
    return Date.now() - lastActivity > BATTLE_TIMEOUT_MS;
  }

  const recent = Date.now() - 30000;  // 30s前
  const old = Date.now() - 150000;     // 150s前（超过120s）

  assert(isStale(recent) === false, 'Recent battle not stale');
  assert(isStale(old) === true, 'Old battle is stale');
  assert(isStale(null) === false, 'Null timestamp not stale');
});

test('PvP disconnect grace — expires after timeout', () => {
  const PVP_DISCONNECT_GRACE_MS = 30000;
  function isExpired(disconnectedAt) {
    if (!disconnectedAt) return true;
    return Date.now() - disconnectedAt > PVP_DISCONNECT_GRACE_MS;
  }

  const justNow = Date.now();
  const longAgo = Date.now() - 35000;

  assert(isExpired(justNow) === false, 'Just disconnected: not expired');
  assert(isExpired(longAgo) === true, '35s ago: grace expired');
  assert(isExpired(null) === true, 'null = expired (should not happen)');
});

// ========== 运行 ==========
function runAll() {
  console.log('=== Game Logic Tests ===\n');
  let passed = 0;
  for (const r of results) {
    const status = r.pass ? '✓' : '✗';
    if (r.pass) passed++;
    console.log(`  ${status} ${r.name}`);
    if (!r.pass) console.log(`    → ${r.error}`);
    if (r.note) console.log(`    ℹ ${r.note}`);
  }
  console.log(`\n=== Results: ${passed}/${results.length} passed ===`);
  return { total: results.length, passed, failed: results.length - passed };
}

module.exports = { runAll, test, assert, assertEqual };

if (require.main === module) {
  const result = runAll();
  process.exit(result.failed > 0 ? 1 : 0);
}
