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
          </div>
          <div class="stat-row">
            <span class="stat-label">敏捷</span>
            <span class="stat-value">{{ gameStore.user?.attributes?.dexterity }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">体质</span>
            <span class="stat-value">{{ gameStore.user?.attributes?.constitution }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">悟性</span>
            <span class="stat-value">{{ gameStore.user?.attributes?.intelligence }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">根骨</span>
            <span class="stat-value">{{ gameStore.user?.attributes?.charisma }}</span>
          </div>
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
      <!-- 房间信息 -->
      <div class="room-info" v-if="gameStore.currentRoom">
        <div class="room-name">{{ gameStore.currentRoom.name }}</div>
        <div class="room-description">{{ gameStore.currentRoom.description }}</div>
        
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
              <button v-if="isEquipment(item.itemId) && !item.equipped" class="item-btn" @click="equipItem(item)">装备</button>
              <button v-if="isEquipment(item.itemId) && item.equipped" class="item-btn equipped-btn" disabled>已装备</button>
              <button class="item-btn sell-btn" @click="sellItem(item)">出售</button>
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
  // 发送look命令获取当前房间信息
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
</style>
