<template>
  <div class="game-container">
    <!-- 左侧面板 - 状态 -->
    <div class="left-panel">
      <!-- 连接状态 -->
      <div class="connection-status" :class="{ connected: gameStore.connected, disconnected: !gameStore.connected }">
        {{ gameStore.connected ? '🟢 已连接' : '🔴 未连接' }}
      </div>
      
      <!-- 当前地图信息 -->
      <div class="map-info">
        <div class="map-name">📍 {{ currentMap?.name || '未知地图' }}</div>
        <div class="map-level">等级范围: {{ currentMap?.level || '1-100' }}</div>
        <div class="room-name">🏠 {{ gameStore.currentRoom?.name || '未知位置' }}</div>
      </div>
      
      <div class="player-info">
        <div class="player-name">{{ gameStore.user?.characterName }}</div>
        <div class="player-level">等级: {{ gameStore.user?.level }} | 门派: {{ factionName }}</div>
        
        <div class="player-stats">
          <div class="stat-row">
            <span class="stat-label">HP</span>
            <span class="stat-value">{{ gameStore.user?.hp?.current }}/{{ gameStore.user?.hp?.max }}</span>
          </div>
          <div class="hp-bar">
            <div class="hp-fill" :style="{ width: hpPercent + '%' }"></div>
            <span class="bar-text">{{ hpPercent }}%</span>
          </div>
          
          <div class="stat-row">
            <span class="stat-label">MP</span>
            <span class="stat-value">{{ gameStore.user?.mp?.current }}/{{ gameStore.user?.mp?.max }}</span>
          </div>
          <div class="mp-bar">
            <div class="mp-fill" :style="{ width: mpPercent + '%' }"></div>
            <span class="bar-text">{{ mpPercent }}%</span>
          </div>
          
          <div class="stat-row">
            <span class="stat-label">经验</span>
            <span class="stat-value">{{ gameStore.user?.exp }}</span>
          </div>
          
          <div class="stat-row">
            <span class="stat-label">金币</span>
            <span class="stat-value">{{ gameStore.user?.gold }}</span>
          </div>
        </div>
        
        <div class="player-attributes">
          <div class="stat-row">
            <span class="stat-label">力量</span>
            <span class="stat-value">{{ gameStore.user?.attributes?.strength }}</span>
            <button v-if="freePoints > 0" class="attr-plus-btn" @click="allocatePoints('strength')">+</button>
          </div>
          <div class="stat-row">
            <span class="stat-label">敏捷</span>
            <span class="stat-value">{{ gameStore.user?.attributes?.dexterity }}</span>
            <button v-if="freePoints > 0" class="attr-plus-btn" @click="allocatePoints('dexterity')">+</button>
          </div>
          <div class="stat-row">
            <span class="stat-label">体质</span>
            <span class="stat-value">{{ gameStore.user?.attributes?.constitution }}</span>
            <button v-if="freePoints > 0" class="attr-plus-btn" @click="allocatePoints('constitution')">+</button>
          </div>
          <div class="stat-row">
            <span class="stat-label">悟性</span>
            <span class="stat-value">{{ gameStore.user?.attributes?.intelligence }}</span>
            <button v-if="freePoints > 0" class="attr-plus-btn" @click="allocatePoints('intelligence')">+</button>
          </div>
          <div class="stat-row">
            <span class="stat-label">根骨</span>
            <span class="stat-value">{{ gameStore.user?.attributes?.charisma }}</span>
            <button v-if="freePoints > 0" class="attr-plus-btn" @click="allocatePoints('charisma')">+</button>
          </div>
          <div v-if="freePoints > 0" class="free-points-hint">
            ✨ 可分配属性点: {{ freePoints }}
          </div>
        </div>
        
        <!-- 门派信息 -->
        <div class="faction-info" v-if="gameStore.user?.faction">
          <div class="faction-header">🏯 {{ factionName }}</div>
          <div class="faction-detail">
            <span>等级: {{ factionRankLabel }}</span>
            <span>声望: {{ gameStore.user?.factionReputation || 0 }}</span>
            <span>贡献: {{ gameStore.user?.factionContribution || 0 }}</span>
          </div>
          <button v-if="canAdvanceFaction" class="faction-advance-btn" @click="advanceFaction">进阶</button>
        </div>
      </div>
      
      <button class="btn btn-secondary" @click="goToAdmin" v-if="gameStore.isGM">
        管理后台
      </button>
      <button class="btn btn-secondary" @click="logout">
        退出登录
      </button>
    </div>
    
    <!-- 中央面板 - 游戏内容 -->
    <div class="center-panel">
      <!-- 死亡遮罩 -->
      <div class="death-overlay" v-if="isDead">
        <div class="death-content">
          <div class="death-icon">💀</div>
          <div class="death-text">你已倒下...</div>
          <div class="death-hint">生命值降为零，你陷入了昏迷</div>
          <button class="revive-btn" @click="revive">🔄 复活</button>
          <div class="death-penalty-hint">复活后将回到村庄中心，恢复30%生命和内力</div>
        </div>
      </div>
      
      <!-- 房间信息 -->
      <div class="room-info" v-if="gameStore.currentRoom && !isDead">
        <div class="room-name">{{ gameStore.currentRoom.name }}</div>
        <div class="room-description">{{ gameStore.currentRoom.description }}</div>
        
        <!-- 地面掉落 -->
        <div class="room-drops" v-if="gameStore.roomDrops?.length">
          <div class="drops-title">📦 地面物品</div>
          <div class="drops-list">
            <div v-for="(drop, idx) in gameStore.roomDrops" :key="drop.itemId + '-' + idx" class="drop-item">
              <span class="drop-name">{{ drop.name || drop.itemId }}</span>
              <span v-if="drop.quantity > 1" class="drop-qty">x{{ drop.quantity }}</span>
              <button class="pickup-btn" @click="pickupItem(drop.itemId)">拾取</button>
            </div>
          </div>
        </div>
        
        <div class="room-exits">
          <span class="exit-label">出口:</span>
          <button 
            v-for="exit in gameStore.currentRoom.exits" 
            :key="exit.roomId"
            class="exit-btn"
            @click="move(exit.direction)"
          >
            {{ directionLabel(exit.direction) }} → {{ exit.roomName }}
          </button>
        </div>
        
        <div class="room-entities">
          <div class="entity-group">
            <div class="entity-title">玩家</div>
            <div class="entity-list">
              <div v-for="player in gameStore.currentRoom.players" :key="player.name" class="entity-item">
                {{ player.name }}({{ player.level }}级)
              </div>
              <div v-if="!gameStore.currentRoom.players?.length" class="entity-item">无</div>
            </div>
          </div>
          
          <div class="entity-group">
            <div class="entity-title">NPC</div>
            <div class="entity-list">
              <div 
                v-for="npc in gameStore.currentRoom.npcs" 
                :key="npc.id" 
                class="entity-item clickable" 
                @click="interactNpc(npc.id)"
                :title="'点击与' + npc.name + '对话'"
              >
                🧑 {{ npc.name }}
              </div>
              <div v-if="!gameStore.currentRoom.npcs?.length" class="entity-item">无</div>
            </div>
          </div>
          
          <div class="entity-group">
            <div class="entity-title">怪物</div>
            <div class="entity-list">
              <div 
                v-for="monster in gameStore.currentRoom.monsters" 
                :key="monster.id" 
                class="entity-item clickable"
                @click="attackMonster(monster.id)"
              >
                {{ monster.name }}({{ monster.level }}级)
              </div>
              <div v-if="!gameStore.currentRoom.monsters?.length" class="entity-item">无</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 战斗界面 -->
      <div class="battle-container" v-if="gameStore.battle">
        <div class="battle-title">⚔️ 战斗中 ⚔️</div>
        <div class="battle-turn-indicator">
          当前行动: {{ currentBattleActorName }}
        </div>
        
        <div class="battle-participants">
          <div class="battle-entity" v-for="participant in gameStore.battle.participants" :key="participant.name">
            <div class="battle-entity-name">{{ participant.name }}</div>
            <div class="battle-hp-bar">
              <div class="battle-hp-fill" :style="{ width: battleHpPercent(participant) + '%' }"></div>
              <span class="battle-hp-text">{{ participant.hp }}/{{ participant.maxHp }}</span>
            </div>
            <div class="battle-mp-text" v-if="typeof participant.mp === 'number' && typeof participant.maxMp === 'number'">
              MP {{ participant.mp }}/{{ participant.maxMp }}
            </div>
            <div class="battle-status-list" v-if="participant.statusSummary?.length">
              <span
                v-for="status in participant.statusSummary"
                :key="`${participant.name}-${status.type}-${status.name}`"
                class="battle-status-tag"
              >
                {{ formatBattleStatus(status) }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="battle-actions">
          <button class="battle-btn attack" @click="battleAction('attack')" :disabled="!isPlayerTurn">攻击</button>
          <button class="battle-btn" @click="battleAction('defend')" :disabled="!isPlayerTurn">防御</button>
          <button class="battle-btn" @click="battleAction('flee')" :disabled="!isPlayerTurn">逃跑</button>
        </div>

        <div class="battle-skills" v-if="playerBattleSkills.length">
          <button
            v-for="skill in playerBattleSkills"
            :key="skill.id"
            class="battle-btn skill"
            :disabled="!isPlayerTurn || !canUseBattleSkill(skill)"
            @click="battleAction('skill', skill.id)"
          >
            {{ skill.name }} (MP {{ skill.mpCost || 0 }})
          </button>
        </div>
      </div>
      
      <!-- 消息区域 -->
      <div class="message-area" ref="messageArea">
        <div v-for="(msg, index) in gameStore.messages" :key="index" class="message" :class="msg.type">
          <span class="message-time">{{ msg.time }}</span>
          <span>{{ msg.content }}</span>
        </div>
      </div>
      
      <!-- 命令输入 -->
      <div class="command-input">
        <input 
          v-model="command" 
          type="text" 
          placeholder="输入命令 (help 查看帮助)" 
          @keyup.enter="sendCommand"
        />
        <button @click="sendCommand">发送</button>
      </div>
      
      <!-- 快捷按钮 -->
      <div v-if="contextualActions.length" class="quick-actions">
        <button
          v-for="action in contextualActions"
          :key="action.command"
          class="quick-btn"
          @click="quickCommand(action.command)"
        >
          {{ action.label }}
        </button>
      </div>
      <div class="quick-actions">
        <button class="quick-btn" @click="quickCommand('look')">👁️ 查看</button>
        <button class="quick-btn" @click="quickCommand('where')">📍 位置</button>
        <button class="quick-btn" @click="quickCommand('status')">📊 状态</button>
      </div>
      <div class="quick-actions">
        <button class="quick-btn" @click="quickCommand('help')">❓ 帮助</button>
        <button class="quick-btn" @click="quickCommand('inventory')">🎒 背包</button>
        <button class="quick-btn" @click="quickCommand('skills')">⚔️ 技能</button>
        <button class="quick-btn" @click="quickCommand('quests')">📜 任务</button>
        <button class="quick-btn" @click="quickCommand('faction')">🏯 门派</button>
      </div>
    </div>
    
    <!-- 右侧面板 - 菜单 -->
    <div class="right-panel">
      <div class="menu-tabs">
        <button class="menu-tab" :class="{ active: activeTab === 'inventory' }" @click="activeTab = 'inventory'">背包</button>
        <button class="menu-tab" :class="{ active: activeTab === 'skills' }" @click="activeTab = 'skills'">技能</button>
        <button class="menu-tab" :class="{ active: activeTab === 'quests' }" @click="activeTab = 'quests'">任务</button>
        <button class="menu-tab" :class="{ active: activeTab === 'battlelog' }" @click="activeTab = 'battlelog'">战报</button>
      </div>
      
      <div class="menu-content">
        <!-- 背包 -->
        <div v-if="activeTab === 'inventory'">
          <div v-for="item in inventory" :key="item._id" class="inventory-item">
            <div class="item-header">
              <span class="item-name" :class="itemRarity(item)">{{ getItemName(item.itemId) }}</span>
              <span class="item-quantity">x{{ item.quantity }}</span>
            </div>
            <div class="item-detail">{{ getItemDescription(item.itemId) }}</div>
            <div class="item-stats" v-if="getItemStats(item.itemId)">
              {{ getItemStats(item.itemId) }}
            </div>
            <div class="item-actions">
              <button v-if="isConsumable(item.itemId)" class="item-btn" @click="useItem(item)">使用</button>
              <button v-if="isEquipment(item.itemId) && !item.isEquipped" class="item-btn" @click="equipItem(item)">装备</button>
              <button v-if="isEquipment(item.itemId) && item.isEquipped" class="item-btn equipped-btn" disabled>已装备</button>
              <button v-if="isEquipment(item.itemId) && (item.durability?.current || 0) < (item.durability?.max || 100)" class="item-btn repair-btn" @click="repairItem(item._id)">修复</button>
              <button class="item-btn sell-btn" @click="sellItem(item)">出售</button>
            </div>
            <div v-if="isEquipment(item.itemId)" class="durability-bar">
              <span class="dur-label">耐久</span>
              <div class="dur-track">
                <div class="dur-fill" :class="durabilityClass(item)" :style="{ width: durabilityPercent(item) + '%' }"></div>
              </div>
              <span class="dur-text" :class="durabilityClass(item)">{{ item.durability?.current || 0 }}/{{ item.durability?.max || 100 }}</span>
            </div>
          </div>
          <div v-if="!inventory.length" class="empty-hint">背包空空如也</div>
        </div>

        <!-- 技能 -->
        <div v-if="activeTab === 'skills'">
          <div v-for="skill in skills" :key="skill._id" class="skill-item">
            <div class="item-header">
              <span class="item-name">{{ getSkillName(skill.skillId) }}</span>
              <span class="skill-level">Lv{{ skill.level }}</span>
            </div>
            <div class="item-detail">{{ getSkillDescription(skill.skillId) }}</div>
            <div class="skill-exp-bar">
              <div class="skill-exp-fill" :style="{ width: skillExpPercent(skill) + '%' }"></div>
              <span class="skill-exp-text">{{ skill.exp || 0 }}/{{ (skill.level || 1) * 100 }}</span>
            </div>
            <div class="skill-meta">
              <span v-if="getSkillMpCost(skill.skillId)">MP {{ getSkillMpCost(skill.skillId) }}</span>
              <span v-if="getSkillType(skill.skillId)" class="skill-type-tag">{{ getSkillTypeLabel(skill.skillId) }}</span>
            </div>
          </div>
          <div v-if="!skills.length" class="empty-hint">尚未学习任何技能</div>
        </div>

        <!-- 任务 -->
        <div v-if="activeTab === 'quests'">
          <div v-for="quest in quests" :key="quest._id" class="quest-item">
            <div class="item-header">
              <span class="item-name">{{ getQuestName(quest.questId) }}</span>
              <span class="quest-status" :class="questStatusClass(quest.status)">{{ questStatus(quest.status) }}</span>
            </div>
            <div v-if="quest.status !== 'completed'" class="quest-objectives">
              <div v-for="obj in getQuestObjectives(quest)" :key="obj.key" class="quest-objective">
                <span :class="{ 'objective-done': obj.done }">{{ obj.label }} {{ obj.current }}/{{ obj.target }}</span>
              </div>
            </div>
            <div v-if="quest.status === 'completed' && !quest.rewardClaimed" class="quest-reward-info">
              {{ getQuestRewardText(quest.questId) }}
            </div>
            <button v-if="quest.status === 'completed' && !quest.rewardClaimed" class="quest-reward-btn" @click="claimQuestReward(quest.questId)">领取奖励</button>
            <div v-if="quest.status === 'completed' && quest.rewardClaimed" class="reward-claimed">已领取奖励</div>
          </div>
          <div v-if="!quests.length" class="empty-hint">没有进行中的任务</div>
        </div>

        <!-- 战斗日志 -->
        <div v-if="activeTab === 'battlelog'">
          <button class="item-btn" @click="loadBattleLogs" style="margin-bottom:8px">刷新战报</button>
          <div v-if="gameStore.battleLogDetail" class="battle-log-detail">
            <button class="item-btn" @click="gameStore.battleLogDetail = null" style="margin-bottom:8px">← 返回列表</button>
            <div class="log-detail-header">{{ gameStore.battleLogDetail.monster?.name || '战斗记录' }}</div>
            <div class="log-detail-result" :class="battleLogWon(gameStore.battleLogDetail) ? 'victory' : 'defeat'">
              {{ battleLogWon(gameStore.battleLogDetail) ? '🏆 胜利' : '💀 失败' }}
            </div>
            <div v-if="gameStore.battleLogDetail.result?.expGained" class="log-detail-info">
              经验 +{{ gameStore.battleLogDetail.result.expGained }}
            </div>
            <div v-if="gameStore.battleLogDetail.result?.goldGained" class="log-detail-info">
              金币 +{{ gameStore.battleLogDetail.result.goldGained }}
            </div>
            <div v-if="gameStore.battleLogDetail.result?.deathPenalty" class="log-detail-info penalty">
              💀 死亡惩罚: 经验 -{{ gameStore.battleLogDetail.result.deathPenalty.expLost || 0 }}, 金币 -{{ gameStore.battleLogDetail.result.deathPenalty.goldLost || 0 }}
            </div>
            <div v-if="gameStore.battleLogDetail.rounds?.length" class="log-turns">
              <div v-for="(turn, i) in gameStore.battleLogDetail.rounds" :key="i" class="log-turn">
                回合{{ turn.round || i+1 }}: {{ formatLogTurn(turn) }}
              </div>
            </div>
          </div>
          <div v-else>
            <div v-for="log in gameStore.battleLogList" :key="log._id" class="battle-log-item" @click="loadBattleLogDetail(log.battleId || log._id)">
              <div class="log-header">
                <span class="log-monster">{{ log.monster?.name || '战斗' }}</span>
                <span class="log-result" :class="log.result?.won ? 'victory' : 'defeat'">
                  {{ log.result?.won ? '胜' : '败' }}
                </span>
              </div>
              <div class="log-meta">
                <span v-if="log.result?.expGained">经验+{{ log.result.expGained }}</span>
                <span v-if="log.result?.goldGained">金币+{{ log.result.goldGained }}</span>
                <span class="log-time">{{ formatLogTime(log.endedAt) }}</span>
              </div>
            </div>
            <div v-if="!gameStore.battleLogList.length" class="empty-hint">暂无战斗记录</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import axios from 'axios'

const router = useRouter()
const gameStore = useGameStore()

const command = ref('')
const activeTab = ref('inventory')
const messageArea = ref(null)

// 计算属性
const isDead = computed(() => gameStore.isDead || (gameStore.user?.hp?.current <= 0 && !gameStore.battle))
const freePoints = computed(() => gameStore.user?.freePoints || gameStore.user?.attributePoints || 0)

const factionRankLabel = computed(() => {
  const rank = gameStore.user?.factionRank
  const labels = { disciple: '弟子', deacon: '执事', elder: '长老', leader: '掌门' }
  return labels[rank] || rank || '弟子'
})

const canAdvanceFaction = computed(() => {
  const rep = gameStore.user?.factionReputation || 0
  const rank = gameStore.user?.factionRank
  if (rank === 'leader') return false
  if (rank === 'elder') return rep >= 5000
  if (rank === 'deacon') return rep >= 2000
  return rep >= 500 // disciple needs 500 to advance
})
const hpPercent = computed(() => {
  if (!gameStore.user?.hp) return 0
  return toPercent(gameStore.user.hp.current, gameStore.user.hp.max)
})

const mpPercent = computed(() => {
  if (!gameStore.user?.mp) return 0
  return toPercent(gameStore.user.mp.current, gameStore.user.mp.max)
})

const factionName = computed(() => {
  if (!gameStore.user?.faction) return '无门无派'
  const faction = gameStore.gameConfig?.factions?.[gameStore.user.faction]
  return faction?.name || gameStore.user.faction
})

const currentMap = computed(() => {
  if (!gameStore.currentRoom || !gameStore.gameConfig) return null
  const roomId = gameStore.currentRoom.id
  const room = gameStore.gameConfig.rooms?.[roomId]
  if (!room) return null
  return gameStore.gameConfig.maps?.[room.mapId] || null
})

const currentRoomServices = computed(() => gameStore.currentRoom?.services || [])

const contextualActions = computed(() => {
  const services = currentRoomServices.value
  const actions = []

  // 休息按钮始终显示（任何地方都可以休息，客栈完全恢复，野外部分恢复）
  actions.push({ label: '💤 休息', command: 'rest' })

  if (services.some(service => ['shop', 'buy_item', 'buy_weapon', 'buy_armor', 'sell_item'].includes(service))) {
    actions.push({ label: '🏪 商店', command: 'shop' })
  }

  if (services.includes('train')) {
    actions.push({ label: '💪 训练', command: 'train' })
  }

  if (services.some(service => ['learn_skill', 'meditate'].includes(service))) {
    actions.push({ label: '📖 学技能', command: 'skills learn' })
  }

  if (services.includes('quest')) {
    actions.push({ label: '📜 接任务', command: 'quests' })
  }

  return actions
})

const inventory = computed(() => gameStore.inventory)
const skills = computed(() => gameStore.skills)
const quests = computed(() => gameStore.quests)
const currentBattleActor = computed(() => {
  const battle = gameStore.battle
  if (!battle?.turnOrder?.length) return null
  return battle.turnOrder[battle.currentTurn] || null
})

const currentBattleActorName = computed(() => currentBattleActor.value?.name || '未知')

const playerBattleParticipant = computed(() => {
  const battle = gameStore.battle
  const userId = gameStore.user?._id
  if (!battle?.participants?.length || !userId) return null

  return battle.participants.find(participant => participant.userId?.toString?.() === userId.toString()) || null
})

const isPlayerTurn = computed(() => {
  const actor = currentBattleActor.value
  const userId = gameStore.user?._id
  if (!actor?.userId || !userId) return false
  return actor.userId.toString() === userId.toString()
})

const playerBattleSkills = computed(() => {
  const participant = playerBattleParticipant.value
  if (!participant?.skills?.length) return []

  return participant.skills.filter(skill => ['attack', 'heal', 'buff', 'debuff', 'defense'].includes(skill.type))
})

// 方向标签
function directionLabel(dir) {
  const labels = {
    'north': '北',
    'south': '南',
    'east': '东',
    'west': '西',
    'up': '上',
    'down': '下',
    'in': '里',
    'out': '外'
  }
  return labels[dir] || dir
}

function toPercent(current, max) {
  if (!max || max <= 0) return 0
  return Math.max(0, Math.min(100, Math.floor((current / max) * 100)))
}

function battleHpPercent(participant) {
  return toPercent(participant.hp, participant.maxHp)
}

// 方法
function sendCommand() {
  if (!command.value.trim()) return
  gameStore.sendCommand(command.value)
  command.value = ''
}

function quickCommand(cmd) {
  gameStore.sendCommand(cmd)
}

function move(direction) {
  gameStore.sendCommand(`move ${direction}`)
}

function attackMonster(monsterId) {
  gameStore.sendCommand(`kill ${monsterId}`)
}

function interactNpc(npcId) {
  gameStore.sendCommand(`talk ${npcId}`)
}

function useItem(item) {
  if (item) {
    gameStore.sendCommand(`use ${item._id}`)
  }
}

function battleAction(action, skillId = null) {
  gameStore.battleAction(action, skillId)
}

function canUseBattleSkill(skill) {
  const participant = playerBattleParticipant.value
  if (!participant) return false
  if ((participant.mp || 0) < (skill.mpCost || 0)) return false
  if (skill.hpCost && participant.hp <= skill.hpCost) return false
  return true
}

function formatBattleStatus(status) {
  return `${status.name}(${status.duration})`
}

function getItemName(itemId) {
  const item = gameStore.gameConfig?.items?.[itemId]
  return item?.name || itemId
}

function getSkillName(skillId) {
  const skill = gameStore.gameConfig?.skills?.[skillId]
  return skill?.name || skillId
}

function getQuestName(questId) {
  const quest = gameStore.gameConfig?.quests?.[questId]
  return quest?.name || questId
}

function questStatus(status) {
  const statusMap = {
    'accepted': '已接取',
    'in_progress': '进行中',
    'completed': '已完成',
    'failed': '失败'
  }
  return statusMap[status] || status
}

function getQuestObjectives(quest) {
  const config = gameStore.gameConfig?.quests?.[quest.questId]
  if (!config?.objectives) return []

  const typeLabels = {
    kill: '击杀', talk: '对话', visit: '到达',
    learn_skill: '学习技能', join_faction: '加入门派',
    buy: '购买', train: '训练', collect: '收集'
  }

  return config.objectives.map(obj => {
    const targetId = obj.monsterId || obj.npcId || obj.roomId || obj.itemId || null
    const key = targetId ? `${obj.type}:${targetId}` : obj.type
    const progress = quest.progress || {}
    const current = typeof progress[key] === 'number' ? progress[key] : (progress[key]?.valueOf?.() || 0)
    const target = obj.count || 1
    const displayName = obj.targetName || targetId || ''
    const label = `${typeLabels[obj.type] || obj.type}${displayName ? ' ' + displayName : ''}`

    return { key, label, current, target, done: current >= target }
  })
}

function claimQuestReward(questId) {
  gameStore.socket?.emit('complete_quest', { questId })
}

function equipItem(item) {
  if (item) {
    gameStore.sendCommand(`use ${item._id}`)
  }
}

function sellItem(item) {
  if (item) {
    gameStore.sendCommand(`sell ${item.itemId}`)
  }
}

function isConsumable(itemId) {
  const item = gameStore.gameConfig?.items?.[itemId]
  return item?.type === 'consumable'
}

function isEquipment(itemId) {
  const item = gameStore.gameConfig?.items?.[itemId]
  return item?.type === 'weapon' || item?.type === 'armor'
}

function getItemDescription(itemId) {
  const item = gameStore.gameConfig?.items?.[itemId]
  return item?.description || ''
}

function getItemStats(itemId) {
  const item = gameStore.gameConfig?.items?.[itemId]
  if (!item) return ''
  const stats = item.stats || item.attributes
  if (!stats) return ''
  return Object.entries(stats).map(([k, v]) => `${statLabel(k)}+${v}`).join(' ')
}

function itemRarity(item) {
  const config = gameStore.gameConfig?.items?.[item.itemId]
  if (!config) return ''
  const req = config.requireLevel || 1
  if (req >= 50) return 'rarity-epic'
  if (req >= 30) return 'rarity-rare'
  if (req >= 10) return 'rarity-uncommon'
  return ''
}

function statLabel(key) {
  const labels = { attack: '攻击', defense: '防御', strength: '力量', dexterity: '敏捷', constitution: '体质', intelligence: '悟性' }
  return labels[key] || key
}

function getSkillDescription(skillId) {
  const skill = gameStore.gameConfig?.skills?.[skillId]
  return skill?.description || ''
}

function getSkillMpCost(skillId) {
  const skill = gameStore.gameConfig?.skills?.[skillId]
  return skill?.mpCost || 0
}

function getSkillType(skillId) {
  const skill = gameStore.gameConfig?.skills?.[skillId]
  return skill?.type || ''
}

function getSkillTypeLabel(skillId) {
  const type = getSkillType(skillId)
  const labels = { attack: '攻击', heal: '治疗', buff: '增益', debuff: '减益', defense: '防御', passive: '被动' }
  return labels[type] || type
}

function skillExpPercent(skill) {
  const exp = skill.exp || 0
  const level = skill.level || 1
  // 经验公式：每级需要 level * 100 经验
  const next = level * 100
  return Math.min(100, Math.floor((exp / next) * 100))
}

function durabilityPercent(item) {
  const max = item.durability?.max || 100
  const cur = item.durability?.current ?? max
  return Math.max(0, Math.floor((cur / max) * 100))
}

function durabilityClass(item) {
  const pct = durabilityPercent(item)
  if (pct <= 30) return 'dur-critical'
  if (pct <= 60) return 'dur-warning'
  return 'dur-good'
}

function formatLogTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
}

function battleLogWon(log) {
  if (!log) return false
  if (log.result?.won) return true
  // Check if any participant with userId is winner
  return log.participants?.some(p => p.isWinner)
}

function formatLogTurn(turn) {
  if (!turn) return ''
  const parts = []
  if (turn.attacker) parts.push(turn.attacker)
  if (turn.action === 'skill' && turn.skill) parts.push(`使用${turn.skill}`)
  else if (turn.action === 'attack') parts.push('攻击')
  else if (turn.action === 'defend') parts.push('防御')
  else if (turn.action === 'flee') parts.push('逃跑')
  else if (turn.action) parts.push(turn.action)
  if (turn.damage) parts.push(`造成${turn.damage}伤害`)
  if (turn.healed) parts.push(`恢复${turn.healed}生命`)
  if (turn.dodged) parts.push('被闪避')
  if (turn.fled) parts.push('成功逃跑')
  return parts.join(' ') || JSON.stringify(turn)
}

function revive() {
  gameStore.revive()
}

function allocatePoints(stat) {
  gameStore.allocatePoints(stat)
}

function pickupItem(itemId) {
  gameStore.pickupItem(itemId)
}

function repairItem(inventoryId) {
  gameStore.repairItem(inventoryId)
}

function loadBattleLogs() {
  gameStore.loadBattleLogs()
}

function loadBattleLogDetail(logId) {
  gameStore.loadBattleLogDetail(logId)
}

function advanceFaction() {
  gameStore.advanceFaction()
}

function questStatusClass(status) {
  const map = { accepted: 'status-accepted', in_progress: 'status-progress', completed: 'status-completed', failed: 'status-failed' }
  return map[status] || ''
}

function getQuestRewardText(questId) {
  const quest = gameStore.gameConfig?.quests?.[questId]
  if (!quest?.rewards) return ''
  const parts = []
  if (quest.rewards.exp) parts.push(`${quest.rewards.exp}经验`)
  if (quest.rewards.gold) parts.push(`${quest.rewards.gold}金币`)
  if (quest.rewards.items?.length) parts.push(quest.rewards.items.map(id => getItemName(id)).join(','))
  return parts.length ? `奖励: ${parts.join(' ')}` : ''
}

function goToAdmin() {
  router.push('/admin')
}

function logout() {
  gameStore.logout()
  router.push('/login')
}

// 自动滚动到底部
watch(gameStore.messages, async () => {
  await nextTick()
  if (messageArea.value) {
    messageArea.value.scrollTop = messageArea.value.scrollHeight
  }
})

onMounted(async () => {
  // 加载游戏配置
  await gameStore.loadGameConfig()
  await gameStore.loadPlayerData()
  // 发送look命令获取当前房间信息（包含drops）
  gameStore.sendCommand('look')
})
</script>

<style scoped>
.connection-status {
  padding: 8px 12px;
  border-radius: 5px;
  margin-bottom: 10px;
  font-size: 14px;
}

.connection-status.connected {
  background: #1a4a2a;
  color: #4ade80;
}

.connection-status.disconnected {
  background: #4a1a1a;
  color: #f87171;
}

.map-info {
  background: #0f3460;
  padding: 10px;
  border-radius: 5px;
  margin-bottom: 15px;
}

.map-name {
  color: #ffd700;
  font-size: 16px;
  margin-bottom: 5px;
}

.map-level {
  color: #aaa;
  font-size: 12px;
}

.room-name {
  color: #4ade80;
  font-size: 14px;
  margin-top: 5px;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  background: #16213e;
  border-radius: 5px;
}

.quick-btn {
  padding: 8px 12px;
  background: #0f3460;
  border: none;
  border-radius: 5px;
  color: #eee;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.quick-btn:hover {
  background: #1a4a7a;
}

.battle-status-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.battle-status-tag {
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(79, 195, 247, 0.18);
  color: #bfe8ff;
  font-size: 12px;
}

.quest-objectives {
  margin-top: 4px;
  padding-left: 8px;
}

.quest-objective {
  font-size: 12px;
  color: #aaa;
  line-height: 1.6;
}

.objective-done {
  color: #4caf50;
  text-decoration: line-through;
}

.quest-reward-btn {
  margin-top: 6px;
  padding: 4px 10px;
  background: #4caf50;
  border: none;
  border-radius: 3px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}

.quest-reward-btn:hover {
  background: #66bb6a;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-quantity {
  color: #aaa;
  font-size: 12px;
}

.item-detail {
  color: #888;
  font-size: 12px;
  margin: 2px 0;
}

.item-stats {
  color: #4fc3f7;
  font-size: 12px;
}

.item-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.item-btn {
  padding: 3px 10px;
  background: #0f3460;
  border: none;
  border-radius: 3px;
  color: #eee;
  cursor: pointer;
  font-size: 12px;
}

.item-btn:hover {
  background: #1a4a7a;
}

.equipped-btn {
  background: #2a5a3a;
  color: #4ade80;
  cursor: default;
}

.sell-btn {
  background: #3a2a1a;
  color: #fbbf24;
}

.sell-btn:hover {
  background: #4a3a2a;
}

.skill-level {
  color: #60a5fa;
  font-size: 12px;
}

.skill-meta {
  display: flex;
  gap: 8px;
  margin-top: 3px;
  font-size: 12px;
  color: #888;
}

.skill-type-tag {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.15);
  color: #93c5fd;
}

.quest-status {
  font-size: 12px;
}

.status-accepted { color: #fbbf24; }
.status-progress { color: #60a5fa; }
.status-completed { color: #4ade80; }
.status-failed { color: #f87171; }

.quest-reward-info {
  font-size: 12px;
  color: #fbbf24;
  margin-top: 4px;
}

.reward-claimed {
  font-size: 12px;
  color: #4ade80;
  margin-top: 4px;
}

.empty-hint {
  color: #666;
  font-size: 13px;
}

.rarity-uncommon { color: #4ade80; }
.rarity-rare { color: #60a5fa; }
.rarity-epic { color: #c084fc; }

/* 死亡遮罩 */
.death-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.death-content {
  text-align: center;
  color: #f87171;
}
.death-icon {
  font-size: 80px;
  margin-bottom: 20px;
}
.death-text {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 10px;
}
.death-hint {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 30px;
}
.revive-btn {
  padding: 12px 40px;
  background: #4caf50;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  transition: background 0.2s;
}
.revive-btn:hover {
  background: #66bb6a;
}
.death-penalty-hint {
  color: #888;
  font-size: 12px;
  margin-top: 15px;
}

/* 地面掉落 */
.room-drops {
  background: rgba(255,215,0,0.1);
  border: 1px solid rgba(255,215,0,0.3);
  border-radius: 5px;
  padding: 8px;
  margin: 8px 0;
}
.drops-title {
  color: #ffd700;
  font-size: 13px;
  margin-bottom: 5px;
}
.drops-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.drop-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #16213e;
  padding: 4px 8px;
  border-radius: 3px;
}
.drop-name { color: #eee; font-size: 12px; }
.drop-qty { color: #aaa; font-size: 11px; }
.pickup-btn {
  padding: 2px 8px;
  background: #4caf50;
  border: none;
  border-radius: 3px;
  color: #fff;
  cursor: pointer;
  font-size: 11px;
}
.pickup-btn:hover { background: #66bb6a; }

/* 属性点分配 */
.attr-plus-btn {
  padding: 1px 6px;
  background: #4caf50;
  border: none;
  border-radius: 3px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  margin-left: 4px;
}
.attr-plus-btn:hover { background: #66bb6a; }
.free-points-hint {
  color: #ffd700;
  font-size: 12px;
  margin-top: 8px;
  text-align: center;
  background: rgba(255,215,0,0.1);
  padding: 4px;
  border-radius: 3px;
}

/* 门派信息 */
.faction-info {
  background: rgba(79,195,247,0.1);
  border: 1px solid rgba(79,195,247,0.3);
  border-radius: 5px;
  padding: 8px;
  margin-top: 10px;
}
.faction-header {
  color: #4fc3f7;
  font-size: 14px;
  font-weight: bold;
}
.faction-detail {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: #aaa;
  margin-top: 4px;
}
.faction-advance-btn {
  padding: 4px 12px;
  background: #4fc3f7;
  border: none;
  border-radius: 3px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  margin-top: 6px;
}
.faction-advance-btn:hover { background: #81d4fa; }

/* 装备耐久 */
.durability-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.dur-label { color: #888; font-size: 11px; }
.dur-track {
  width: 60px;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}
.dur-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}
.dur-good { background: #4caf50; }
.dur-warning { background: #fbbf24; }
.dur-critical { background: #f87171; }
.dur-text { font-size: 11px; }
.dur-good.dur-text { color: #4caf50; }
.dur-warning.dur-text { color: #fbbf24; }
.dur-critical.dur-text { color: #f87171; }
.repair-btn {
  background: #1565c0;
  color: #4fc3f7;
}
.repair-btn:hover { background: #1976d2; }

/* 技能经验条 */
.skill-exp-bar {
  width: 100%;
  height: 12px;
  background: #333;
  border-radius: 6px;
  overflow: hidden;
  margin-top: 4px;
}
.skill-exp-fill {
  height: 100%;
  background: #60a5fa;
  border-radius: 6px;
  transition: width 0.3s;
}
.skill-exp-text {
  font-size: 10px;
  color: #aaa;
  margin-top: 2px;
}

/* 战斗日志 */
.battle-log-item {
  background: #16213e;
  padding: 8px;
  border-radius: 5px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.battle-log-item:hover { background: #1a3a5e; }
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.log-monster { color: #eee; font-size: 13px; }
.log-result { font-size: 12px; font-weight: bold; }
.log-result.victory { color: #4ade80; }
.log-result.defeat { color: #f87171; }
.log-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #888;
  margin-top: 3px;
}
.log-time { color: #666; }
.battle-log-detail {
  background: #16213e;
  padding: 10px;
  border-radius: 5px;
}
.log-detail-header {
  color: #eee;
  font-size: 16px;
  font-weight: bold;
}
.log-detail-result { font-size: 18px; font-weight: bold; margin: 8px 0; }
.log-detail-result.victory { color: #4ade80; }
.log-detail-result.defeat { color: #f87171; }
.log-detail-info { color: #fbbf24; font-size: 13px; }
.log-detail-info.penalty { color: #f87171; }
.log-turns { margin-top: 8px; }
.log-turn { color: #aaa; font-size: 12px; line-height: 1.6; }
</style>
