import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { io } from 'socket.io-client'

export const useGameStore = defineStore('game', () => {
  // 状态
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(null)
  const socket = ref(null)
  const connected = ref(false)
  const currentRoom = ref(null)
  const messages = ref([])
  const players = ref([])
  const battle = ref(null)
  const inventory = ref([])
  const skills = ref([])
  const quests = ref([])
  const gameConfig = ref(null)
  const isDead = ref(false)
  const roomDrops = ref([])
  const battleLogList = ref([])
  const battleLogDetail = ref(null)
  const onlinePlayers = ref([])
  const activeTrade = ref(null)
  const pvpChallenge = ref(null)
  const npcDialog = ref(null)   // { npc, message, availableQuests }
  const questProgress = ref({}) // { questId: { progress, status } }
  const achievements = ref({ achieved: [], available: [] })
  const forgeRecipes = ref([])
  const timeInfo = ref(null)
  // Phase 7-8: 副本/帮派/拍卖行/生活技能/每日活跃
  const dungeons = ref([])
  const currentDungeon = ref(null)
  const dungeonWave = ref(null)
  // P6: 新副本类型
  const towerState = ref(null)     // { floor, totalFloors, currentReward }
  const stealthState = ref(null)   // { battleId, layer, position, detections, score }
  const driftState = ref(null)     // { battleId, mode, distance, maxDistance, anchored }
  const gangs = ref([])
  const myGang = ref(null)
  const auctions = ref({ listings: [], myListings: [] })
  const gatheringNodes = ref([])
  const alchemyRecipes = ref([])
  const cookingRecipes = ref([])
  const dailyStatus = ref(null)
  const activityRewards = ref([])
  
  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isGM = computed(() => user.value?.role === 'gm' || user.value?.role === 'admin')
  const isAdmin = computed(() => user.value?.role === 'admin')
  
  // API基础URL
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
  
  // 设置axios默认配置
  axios.defaults.baseURL = apiBase
  
  // 如果有token，设置Authorization
  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }
  
  // 方法
  async function login(username, password) {
    try {
      const response = await axios.post('/auth/login', { username, password })
      token.value = response.data.data.token
      user.value = response.data.data.user
      localStorage.setItem('token', token.value)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      connectSocket()
      await loadPlayerData()
      return { success: true }
    } catch (error) {
      return { success: false, message: error.response?.data?.message || '登录失败' }
    }
  }
  
  async function register(userData) {
    try {
      const response = await axios.post('/auth/register', userData)
      token.value = response.data.data.token
      user.value = response.data.data.user
      localStorage.setItem('token', token.value)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      connectSocket()
      await loadPlayerData()
      return { success: true }
    } catch (error) {
      return { success: false, message: error.response?.data?.message || '注册失败' }
    }
  }
  
  async function checkAuth() {
    if (!token.value) return false
    
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      const response = await axios.get('/user/me')
      user.value = response.data.data
      connectSocket()
      await loadPlayerData()
      return true
    } catch (error) {
      logout()
      return false
    }
  }
  
  function logout() {
    token.value = ''
    user.value = null
    currentRoom.value = null
    messages.value = []
    battle.value = null
    inventory.value = []
    skills.value = []
    quests.value = []
    npcDialog.value = null
    questProgress.value = {}
    onlinePlayers.value = []
    battleLogList.value = []
    battleLogDetail.value = null
    activeTrade.value = null
    pvpChallenge.value = null
    achievements.value = []
    forgeRecipes.value = []
    timeInfo.value = null
    roomDrops.value = []
    connected.value = false
    delete axios.defaults.headers.common['Authorization']
    localStorage.removeItem('token')
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    // 强制刷新页面确保所有组件状态彻底清空
    window.location.reload()
  }
  
  function connectSocket() {
    if (socket.value) return
    
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'
    socket.value = io(socketUrl, {
      auth: { token: token.value }
    })
    
    socket.value.on('connect', () => {
      connected.value = true
      console.log('Socket connected')
      addMessage('system', '已连接到游戏服务器')
    })
    
    socket.value.on('disconnect', (reason) => {
      connected.value = false
      console.log('Socket disconnected:', reason)
      addMessage('error', '⚠️ 与服务器断开连接，即将返回登录界面...')
      // 3秒后踢到登录界面
      setTimeout(() => {
        if (!connected.value) logout()
      }, 3000)
    })

    socket.value.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      connected.value = false
      addMessage('error', '❌ 连接服务器失败: ' + error.message)
      // 连接失败立即踢到登录界面
      setTimeout(() => logout(), 2000)
    })
    
    socket.value.on('welcome', (data) => {
      console.log('Welcome data:', data)
      addMessage('system', data.message)
      if (data.tip) {
        addMessage('tip', data.tip)
      }
      if (data.room) {
        currentRoom.value = data.room
        addMessage('room', `你当前在: ${data.room.name}`)
      }
      if (data.player) {
        user.value = { ...user.value, ...data.player }
      }
    })
    
    socket.value.on('room_info', (room) => {
      console.log('Room info:', room)
      currentRoom.value = room
      if (room?.drops) {
        roomDrops.value = room.drops
      } else {
        roomDrops.value = []
      }
      if (room) {
        addMessage('room', `【${room.name}】${room.description}`)
        if (room.exits && room.exits.length > 0) {
          addMessage('room', `出口: ${room.exits.map(e => e.direction + '(' + e.roomName + ')').join(', ')}`)
        }
      }
    })
    
    socket.value.on('chat_message', (data) => {
      const channelLabels = {
        world: '【世界】',
        room: '【区域】',
        private: '【私聊】',
        system: '【系统】'
      }
      const label = channelLabels[data.channel] || `【${data.channel}】`
      const prefix = data.channel === 'private' && data.receiver 
        ? `${label}${data.sender}→${data.receiver}` 
        : `${label}${data.sender}`
      addMessage(data.channel, `${prefix} ${data.content}`)
    })
    
    socket.value.on('system_message', (data) => {
      addMessage('system', data.content)
    })
    
    socket.value.on('player_entered', (data) => {
      addMessage('room', `${data.name}(${data.level}级) 来到了这里。`)
    })
    
    socket.value.on('player_left', (data) => {
      addMessage('room', `${data.name} 离开了。`)
    })
    
    socket.value.on('battle_started', (data) => {
      battle.value = data
      addMessage('system', '战斗开始！')
    })
    
    socket.value.on('battle_update', (data) => {
      battle.value = data.battle
      const result = data.result
      if (result.dodged) {
        addMessage('battle', `${result.defender} 闪避了攻击！`)
      } else if (result.skipped) {
        addMessage('battle', `${result.attacker} 本回合无法行动。`)
      } else if (result.defending) {
        addMessage('battle', `${result.attacker} 进入了防御姿态。`)
      } else if (result.fled !== undefined) {
        if (result.fled) {
          addMessage('battle', `${result.attacker} 逃跑成功！`)
        } else {
          addMessage('battle', `${result.attacker} 逃跑失败！`)
        }
      } else if (result.skill && result.healed) {
        addMessage('battle', `${result.attacker} 施展 ${result.skill}，恢复了 ${result.healed} 点HP！`)
      } else if (result.skill && ['buff', 'debuff', 'defense'].includes(result.skillType)) {
        addMessage('battle', `${result.attacker} 施展了 ${result.skill}。`)
      } else if (result.skill && result.damage <= 0) {
        addMessage('battle', `${result.attacker} 施展了 ${result.skill}。`)
      } else if (result.skill) {
        addMessage('battle', `${result.attacker} 施展 ${result.skill}，对 ${result.defender} 造成 ${result.damage} 点伤害！`)
      } else {
        addMessage('battle', `${result.attacker} 对 ${result.defender} 造成 ${result.damage} 点伤害！`)
      }

      if (result.effectMessages?.length) {
        result.effectMessages.forEach(message => addMessage('battle', message))
      }
    })
    
    socket.value.on('battle_ended', async (data) => {
      battle.value = null
      // 检查是否死亡：loser是玩家 或 HP<=0
      const userId = user.value?._id
      const loserId = data.battle?.loser?.userId
      const isLoser = loserId && userId && loserId.toString() === userId.toString()
      const hpZero = user.value?.hp?.current <= 0
      if (isLoser || hpZero) {
        isDead.value = true
      }
      addMessage('system', '战斗结束！')
      if (data.result?.mutualDefeat) {
        addMessage('battle', '双方同归于尽。')
      }
      if (data.rewards) {
        addMessage('system', `获得 ${data.rewards.expGained} 经验, ${data.rewards.goldGained} 金币`)
      }
      if (data.rewards?.autoLooted?.length) {
        addMessage('success', `🎒 自动拾取: ${data.rewards.autoLooted.join(', ')}`)
      }
      if (data.rewards?.deathPenalty) {
        const p = data.rewards.deathPenalty
        addMessage('error', `💀 死亡惩罚: 经验 -${p.expLost || 0}, 金币 -${p.goldLost || 0}`)
      }
      if (data.rewards?.skillExp?.length) {
        for (const se of data.rewards.skillExp) {
          if (se.leveledUp) {
            addMessage('success', `🔺 ${se.skillName} 升级至 Lv${se.newLevel}！`)
          }
        }
      }
      await Promise.all([refreshCurrentUser(), loadInventory(), loadQuests()])
    })
    
    socket.value.on('error', (data) => {
      addMessage('error', data.message)
    })
    
    socket.value.on('rest_complete', async (data) => {
      // 立即更新HP/MP显示
      if (user.value && data.hp) {
        user.value.hp = data.hp
        user.value.mp = data.mp
      }
      if (data.fullRecovery) {
        addMessage('success', '💤 休息完毕，生命和内力完全恢复！')
      } else {
        addMessage('success', '💤 野外休息，恢复了部分生命和内力。（客栈可完全恢复）')
      }
      await refreshCurrentUser()
    })
    
    socket.value.on('natural_regen', (data) => {
      if (user.value) {
        user.value.hp = data.hp
        user.value.mp = data.mp
      }
    })
    
    socket.value.on('revived', async (data) => {
      isDead.value = false
      addMessage('success', data.message || '你已复活')
      if (data.hp) user.value.hp = data.hp
      if (data.mp) user.value.mp = data.mp
      if (data.location) user.value.location = data.location
      await Promise.all([refreshCurrentUser(), loadInventory()])
      // 重新获取房间信息（复活后位置变了）
      if (socket.value) socket.value.emit('look')
    })
    
    socket.value.on('room_drops', (data) => {
      roomDrops.value = data.drops || []
    })
    
    socket.value.on('room_drops_updated', (data) => {
      roomDrops.value = data.drops || []
    })
    
    socket.value.on('item_picked_up', async (data) => {
      addMessage('success', `拾取了 ${data.name || data.itemId || '物品'}${data.quantity > 1 ? '×' + data.quantity : ''}`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    
    socket.value.on('points_allocated', async (data) => {
      addMessage('success', `属性点分配成功！${data.statName || data.stat} +${data.pointsAllocated || data.amount || 1}`)
      await refreshCurrentUser()
    })
    
    socket.value.on('battle_logs', (data) => {
      // 存储战斗日志列表供UI使用
      battleLogList.value = data.logs || []
    })
    
    socket.value.on('battle_detail', (data) => {
      battleLogDetail.value = data
    })
    
    socket.value.on('online_players', (data) => {
      onlinePlayers.value = data.players || []
    })
    
    socket.value.on('trade_started', (data) => {
      activeTrade.value = { tradeId: data.tradeId, role: data.role, partner: data.partner }
      addMessage('system', `交易开始！与 ${data.partner} 的交易`)
    })
    
    socket.value.on('trade_updated', (data) => {
      activeTrade.value = data
    })
    
    socket.value.on('trade_completed', (data) => {
      addMessage('success', data.message || '交易完成！')
      activeTrade.value = null
      Promise.all([refreshCurrentUser(), loadInventory()])
    })
    
    socket.value.on('trade_cancelled', (data) => {
      addMessage('system', '交易已取消')
      activeTrade.value = null
    })
    
    socket.value.on('pvp_challenge_received', (data) => {
      addMessage('system', `⚔️ ${data.challengerName}(Lv${data.challengerLevel}) 向你发起了PVP挑战！`)
      pvpChallenge.value = data
    })

    socket.value.on('pvp_challenge_expired', (data) => {
      addMessage('warning', `${data.challengerName} 的挑战已超时取消`)
      pvpChallenge.value = null
    })

    socket.value.on('achievements', (data) => {
      achievements.value = data
    })
    
    socket.value.on('forge_recipes', (data) => {
      forgeRecipes.value = data.recipes || []
    })
    
    socket.value.on('forge_success', async (data) => {
      addMessage('success', data.message || '锻造成功！')
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })

    socket.value.on('forge_failed', async (data) => {
      addMessage('error', data.message || '锻造失败')
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    
    socket.value.on('time_info', (data) => {
      timeInfo.value = data
    })

    // ===== Phase 7-8: 副本 =====
    socket.value.on('dungeons_list', (data) => {
      dungeons.value = data.dungeons || []
    })
    socket.value.on('dungeon_entered', (data) => {
      currentDungeon.value = data
      addMessage('system', `进入副本「${data.dungeonName}」！`)
    })
    socket.value.on('dungeon_wave', (data) => {
      dungeonWave.value = data
      addMessage('battle', `第 ${data.wave} 波敌人出现！`)
    })
    socket.value.on('dungeon_completed', async (data) => {
      addMessage('success', `副本「${data.dungeonName}」通关！`)
      if (data.rewards) {
        const parts = []
        if (data.rewards.exp) parts.push(`经验+${data.rewards.exp}`)
        if (data.rewards.gold) parts.push(`金币+${data.rewards.gold}`)
        addMessage('success', `奖励: ${parts.join(', ')}`)
      }
      currentDungeon.value = null
      dungeonWave.value = null
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    socket.value.on('dungeon_left', async (data) => {
      addMessage('system', data.message || '已退出副本')
      currentDungeon.value = null
      dungeonWave.value = null
    })

    // ===== P6: 万安塔 (爬塔) =====
    socket.value.on('tower_floor', (data) => {
      towerState.value = data
      addMessage('battle', `万安塔 第${data.floor}/${data.totalFloors}层 — ${data.description}`)
    })
    socket.value.on('tower_floor_cleared', (data) => {
      towerState.value = null  // 清除，等待请求下一层
      addMessage('success', data.message)
    })
    socket.value.on('tower_completed', async (data) => {
      towerState.value = null
      addMessage('success', data.message)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    socket.value.on('tower_exited', async (data) => {
      towerState.value = null
      addMessage('success', data.message)
      if (data.rewards) {
        addMessage('success', `获得经验+${data.rewards.exp}，潜能+${data.rewards.gold}`)
      }
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })

    // ===== P6: 藏经阁 (潜行) =====
    socket.value.on('stealth_started', (data) => {
      stealthState.value = data
      addMessage('system', data.message)
    })
    socket.value.on('stealth_moved', (data) => {
      if (stealthState.value) {
        stealthState.value.position = data.position
      }
    })
    socket.value.on('stealth_detected', (data) => {
      if (stealthState.value) {
        stealthState.value.detections = data.detections
      }
    })
    socket.value.on('stealth_item_found', (data) => {
      if (stealthState.value) {
        stealthState.value.score = (stealthState.value.score || 0) + 100
      }
    })
    socket.value.on('stealth_layer_complete', (data) => {
      if (data.nextLayer) {
        stealthState.value = { ...stealthState.value, ...data.nextLayer, position: 0, detections: 0 }
        addMessage('success', `进入藏经阁第${data.nextLayer.number}层！`)
      }
    })
    socket.value.on('stealth_completed', async (data) => {
      stealthState.value = null
      addMessage('success', `藏经阁探索完成！积分：${data.score}，残页：${data.collected}`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    socket.value.on('stealth_failed', (data) => {
      stealthState.value = null
      addMessage('error', data.message)
    })

    // ===== P6: 鄱阳湖漂流 (航海) =====
    socket.value.on('drift_started', (data) => {
      driftState.value = data
      addMessage('system', data.message)
    })
    socket.value.on('drift_navigated', (data) => {
      if (driftState.value) {
        driftState.value.distance = data.distance
        if (data.foundItems) {
          addMessage('success', `寻得宝物：${data.foundItems.join(', ')}`)
        }
      }
    })
    socket.value.on('drift_encounter', (data) => {
      if (driftState.value) {
        driftState.value.distance = data.distance
      }
      if (data.encounter) {
        addMessage('battle', data.encounter.message)
      }
    })
    socket.value.on('drift_completed', async (data) => {
      driftState.value = null
      addMessage('success', `漂流结束！航程${data.distance}里，宝物${data.totalItems}件，杀贼${data.banditsKilled}个`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })

    // ===== Phase 7-8: 帮派 =====
    socket.value.on('gang_created', (data) => {
      myGang.value = data.gang
      addMessage('success', `帮派「${data.gang.name}」创建成功！`)
    })
    socket.value.on('gang_search_result', (data) => {
      gangs.value = data.gangs || []
    })
    socket.value.on('gang_joined', async (data) => {
      addMessage('success', data.message || '加入帮派成功')
      await loadGangInfo()
    })
    socket.value.on('gang_left', (data) => {
      myGang.value = null
      addMessage('system', data.message || '已退出帮派')
    })
    socket.value.on('gang_info', (data) => {
      myGang.value = data
    })
    socket.value.on('gang_donation_complete', (data) => {
      addMessage('success', `捐献成功！贡献 +${data.contributionGained}`)
    })
    socket.value.on('gang_withdraw_complete', (data) => {
      addMessage('success', `从帮派仓库取出: ${data.itemName}×${data.quantity}`)
    })

    // ===== Phase 7-8: 拍卖行 =====
    socket.value.on('auction_search_result', (data) => {
      auctions.value = { ...auctions.value, listings: data.listings || [] }
    })
    socket.value.on('auction_my_listings', (data) => {
      auctions.value = { ...auctions.value, myListings: data.listings || [] }
    })
    socket.value.on('auction_created', async (data) => {
      addMessage('success', `已上架 ${data.itemName}，单价 ${data.price} 金币`)
      await loadInventory()
    })
    socket.value.on('auction_bought', async (data) => {
      addMessage('success', `购买了 ${data.itemName}，花费 ${data.price} 金币`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    socket.value.on('auction_cancelled', async (data) => {
      addMessage('system', data.message || '已下架')
      await loadInventory()
    })

    // ===== Phase 7-8: 生活技能 =====
    socket.value.on('gathering_nodes', (data) => {
      gatheringNodes.value = data.nodes || []
    })
    socket.value.on('gather_success', async (data) => {
      addMessage('success', `采集成功: ${data.itemName || data.itemId}×${data.quantity || 1}`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    socket.value.on('gather_failed', (data) => {
      addMessage('error', data.message || '采集失败')
    })
    socket.value.on('alchemy_recipes', (data) => {
      alchemyRecipes.value = data.recipes || []
    })
    socket.value.on('alchemy_success', async (data) => {
      addMessage('success', data.message || '炼药成功！')
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    socket.value.on('alchemy_failed', (data) => {
      addMessage('error', data.message || '炼药失败')
    })
    socket.value.on('cooking_recipes', (data) => {
      cookingRecipes.value = data.recipes || []
    })
    socket.value.on('cooking_success', async (data) => {
      addMessage('success', data.message || '烹饪成功！')
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    socket.value.on('cooking_failed', (data) => {
      addMessage('error', data.message || '烹饪失败')
    })

    // ===== Phase 7-8: 每日活跃 =====
    socket.value.on('daily_status', (data) => {
      dailyStatus.value = data
    })
    socket.value.on('daily_checkin_result', (data) => {
      addMessage('success', data.message || `签到成功！连续签到 ${data.streak} 天`)
      dailyStatus.value = { ...dailyStatus.value, ...data }
      refreshCurrentUser()
    })
    socket.value.on('daily_task_claimed', async (data) => {
      addMessage('success', data.message || '每日任务奖励已领取')
      await refreshCurrentUser()
    })
    socket.value.on('activity_reward_claimed', async (data) => {
      addMessage('success', data.message || '活跃度奖励已领取')
      await refreshCurrentUser()
    })

    socket.value.on('achievement_unlocked', (data) => {
      addMessage('achievement', `🏆 成就解锁: ${data.name} - ${data.description}`)
      if (data.rewards) {
        const rewardText = []
        if (data.rewards.exp) rewardText.push(`经验+${data.rewards.exp}`)
        if (data.rewards.gold) rewardText.push(`金币+${data.rewards.gold}`)
        if (data.rewards.title) rewardText.push(`称号: ${data.rewards.title}`)
        if (rewardText.length) addMessage('achievement', `奖励: ${rewardText.join('，')}`)
      }
    })
    
    socket.value.on('faction_advanced', async (data) => {
      addMessage('success', data.message || '门派等级提升！')
      await refreshCurrentUser()
    })
    
    socket.value.on('item_repaired', async (data) => {
      addMessage('success', `修复了 ${data.itemId || '装备'}，花费 ${data.repairCost} 金币`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    
    socket.value.on('items_repaired', async (data) => {
      addMessage('success', `修复了 ${data.repairedItems?.length || 0} 件装备，花费 ${data.totalCost} 金币`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    
    socket.value.on('npc_dialog', (data) => {
      addMessage('npc', `【${data.npc.name}】${data.message}`)
      if (data.roomServices && data.roomServices.length > 0) {
        addMessage('system', `可用服务: ${data.roomServices.join(', ')}`)
      }
      // 存储NPC对话数据用于显示可接任务UI
      if (data.availableQuests && data.availableQuests.length > 0) {
        npcDialog.value = data
      } else {
        npcDialog.value = null
      }
    })

    socket.value.on('quest_progress', async (data) => {
      questProgress.value = { ...questProgress.value, [data.questId]: data }
      if (data.status === 'completed') {
        addMessage('success', `📋 任务「${data.questName}」已完成！找NPC领取奖励。`)
        await loadQuests()
      } else {
        addMessage('system', `📋 任务进度: ${data.questName} 已更新`)
      }
    })
    
    socket.value.on('shop_items', (data) => {
      addMessage('shop', `【${data.roomName}商店】`)
      data.items.forEach(item => {
        const sellInfo = item.sellPrice ? ` | 出售价:${item.sellPrice}金` : ''
        addMessage('shop', `  [${item.id}] ${item.name} - 买${item.price}金 / 卖${item.sellPrice || '?'}金 - ${item.description}`)
      })
      addMessage('shop', '输入 buy <物品ID或名称> 购买，例如: buy 木剑')
    })
    
    socket.value.on('item_bought', async (data) => {
      addMessage('success', `购买了 ${data.quantity} 个 ${data.item.name}`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })
    
    socket.value.on('item_sold', async (data) => {
      addMessage('success', `出售了 ${data.quantity} 个 ${data.item.name}`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })

    socket.value.on('item_used', async (data) => {
      if (data.item.type === 'skill_book') {
        if (data.success) {
          addMessage('success', data.message || `成功领悟了「${data.skillLearned}」！`)
        } else {
          addMessage('system', data.message || `研读《${data.item.name}》失败……`)
        }
      } else {
        addMessage('success', `使用了 ${data.item.name}`)
      }
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })

    socket.value.on('item_equipped', async (data) => {
      addMessage('success', `${data.item.name} 已装备到 ${data.slot} 槽位`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })

    socket.value.on('item_unequipped', async (data) => {
      addMessage('info', `已卸下装备（${data.slot} 槽位）`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })

    socket.value.on('skill_learned', async (data) => {
      addMessage('success', `学会了技能「${data.skill.name}」！`)
      await Promise.all([refreshCurrentUser(), loadSkills()])
    })

    socket.value.on('quest_accepted', async (data) => {
      addMessage('success', `接取了任务「${data.quest.name}」`)
      await loadQuests()
    })

    socket.value.on('quest_completed', async (data) => {
      addMessage('success', `完成了任务「${data.quest.name}」`)
      await Promise.all([refreshCurrentUser(), loadInventory(), loadQuests()])
    })

    socket.value.on('quest_progress', async (data) => {
      const progressText = Object.entries(data.progress)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ')
      if (data.status === 'completed') {
        addMessage('success', `任务「${data.questName}」已完成！请领取奖励`)
      } else {
        addMessage('info', `任务「${data.questName}」进度更新: ${progressText}`)
      }
      await loadQuests()
    })
    
    socket.value.on('learnable_skills', (data) => {
      addMessage('system', '可学习技能:')
      data.skills.forEach(skill => {
        const price = skill.learnPrice || 0
        const level = skill.requireLevel || 1
        addMessage('skill', `  ${skill.name} (Lv${level}) - ${price}金币 - ${skill.description}`)
      })
    })
    
    socket.value.on('stat_trained', async (data) => {
      addMessage('success', `${data.stat} 提升到 ${data.newValue}`)
      await refreshCurrentUser()
    })

    socket.value.on('faction_joined', async (data) => {
      addMessage('success', data.message || '已加入门派')
      await refreshCurrentUser()
    })

    socket.value.on('factions_list', (data) => {
      addMessage('system', '【江湖门派】')
      data.forEach(f => {
        addMessage('system', `  [${f.id}] ${f.name} - ${f.description} (需等级${f.requireLevel})`)
      })
      addMessage('system', '输入 faction join <门派ID> 加入门派')
    })

    socket.value.on('faction_left', (data) => {
      addMessage('system', data.message || '已退出门派')
      refreshCurrentUser()
    })

    socket.value.on('faction_task_completed', (data) => {
      addMessage('success', `捐献了 ${data.goldDonated} 金币，获得 ${data.reputationGained} 门派声望`)
      addMessage('system', `当前声望: ${data.totalReputation} | 门派贡献: ${data.totalContribution} | 等级: ${data.factionRank}`)
      refreshCurrentUser()
    })

    socket.value.on('faction_quests_list', (data) => {
      addMessage('system', `【${data.factionId} 门派任务】`)
      data.quests.forEach(q => {
        const status = q.playerStatus
        let statusStr = status ? (status.rewardClaimed ? '✓已领奖' : (status.status === 'completed' ? '可领奖' : status.status)) : '可接取'
        addMessage('system', `  [${q.id}] ${q.name} (${q.type}) - ${statusStr}`)
        if (status && status.status === 'completed' && !status.rewardClaimed) {
          addMessage('system', `    → 输入 faction quest complete ${q.id} 领取奖励`)
        }
        if (!status || (status.status !== 'completed' && status.status !== 'accepted' && status.status !== 'in_progress')) {
          addMessage('system', `    → 输入 faction quest accept ${q.id} 接取`)
        }
      })
    })

    socket.value.on('faction_quest_accepted', (data) => {
      addMessage('success', `已接取门派任务: ${data.quest.name}`)
    })

    socket.value.on('faction_quest_completed', (data) => {
      const r = data.rewards
      const parts = []
      if (r.exp) parts.push(`经验+${r.exp}`)
      if (r.gold) parts.push(`金币+${r.gold}`)
      if (r.factionReputation) parts.push(`声望+${r.factionReputation}`)
      addMessage('success', `任务完成: ${data.quest.name}！${parts.join(', ')}`)
      refreshCurrentUser()
    })

    socket.value.on('faction_exchange_list', (data) => {
      addMessage('system', `【${data.factionName}贡献兑换】(你的贡献: ${data.myContribution}, 等级: ${data.myRank})`)
      if (data.items.length === 0) {
        addMessage('system', '  暂无可兑换的技能（可能等级不足或已全部学会）')
      }
      data.items.forEach(s => {
        addMessage('system', `  [${s.id}] ${s.name} - 消耗 ${s.contributionCost} 贡献 (学习原价${s.learnPrice}金)`)
      })
      addMessage('system', '输入 faction exchange <技能ID> 进行兑换')
    })

    socket.value.on('faction_exchanged', async (data) => {
      addMessage('success', `用 ${data.cost} 贡献兑换了「${data.skillName}」！剩余贡献: ${data.remainingContribution}`)
      await refreshCurrentUser()
    })
  }

  function addMessage(type, content) {
    messages.value.push({
      type,
      content,
      time: new Date().toLocaleTimeString()
    })
    // 保留最近100条消息
    if (messages.value.length > 100) {
      messages.value.shift()
    }
  }
  
  function sendCommand(command) {
    if (!socket.value || !connected.value) return
    
    // 解析命令
    const parts = command.trim().split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)
    
    switch (cmd) {
      case 'look':
      case 'l':
        socket.value.emit('look')
        break
      case 'go':
      case 'move':
        socket.value.emit('move', { direction: args[0] })
        break
      case 'north':
      case 'n':
        socket.value.emit('move', { direction: 'north' })
        break
      case 'south':
      case 's':
        socket.value.emit('move', { direction: 'south' })
        break
      case 'east':
      case 'e':
        socket.value.emit('move', { direction: 'east' })
        break
      case 'west':
      case 'w':
        socket.value.emit('move', { direction: 'west' })
        break
      case 'kill':
      case 'attack':
        socket.value.emit('battle_start', { targetId: args[0], type: 'pve' })
        break
      case 'skill':
        if (battle.value) {
          battleAction('skill', args[0])
        } else {
          addMessage('error', '不在战斗中时，请使用 learn <技能ID> 学习技能')
        }
        break
      case 'use':
        // 支持 use <物品名称> 或 use <inventoryId>
        if (args[0] && args[0].length === 24 && /^[a-f0-9]+$/i.test(args[0])) {
          socket.value.emit('use_item', { inventoryId: args[0] })
        } else {
          socket.value.emit('use_item', { itemName: args.join(' ') })
        }
        break
      case 'quest':
        if (args[0] === 'accept') {
          socket.value.emit('accept_quest', { questId: args[1] })
        } else if (args[0] === 'complete') {
          socket.value.emit('complete_quest', { questId: args[1] })
        }
        break
      case 'chat':
        socket.value.emit('chat_world', { content: args.join(' ') })
        break
      case 'say':
        socket.value.emit('chat_room', { content: args.join(' ') })
        break
      case 'tell':
        socket.value.emit('chat_private', { targetId: args[0], content: args.slice(1).join(' ') })
        break
      case 'faction':
        if (args[0] === 'join') {
          socket.value.emit('join_faction', { factionId: args[1] })
        } else if (args[0] === 'leave') {
          socket.value.emit('leave_faction')
        } else if (args[0] === 'advance') {
          socket.value.emit('faction_advance')
        } else if (args[0] === 'quests') {
          socket.value.emit('list_faction_quests')
        } else if (args[0] === 'quest' && args[1] === 'accept') {
          socket.value.emit('accept_faction_quest', { questId: args[2] })
        } else if (args[0] === 'quest' && args[1] === 'complete') {
          socket.value.emit('complete_faction_quest', { questId: args[2] })
        } else if (args[0] === 'exchange' && args[1]) {
          socket.value.emit('faction_exchange', { skillId: args[1] })
        } else if (args[0] === 'exchange') {
          socket.value.emit('faction_exchange_list')
        } else {
          socket.value.emit('list_factions')
        }
        break
      case 'help':
        // Send to server for dynamic help (includes context-sensitive tips)
        socket.value.emit('help')
        // Also show basic static reference
        addMessage('system', '【移动命令】')
        addMessage('system', '  look/l - 查看当前房间')
        addMessage('system', '  go/move <方向> - 移动(n/s/e/w/up/down/in/out)')
        addMessage('system', '  where - 查看当前位置详情')
        addMessage('system', '')
        addMessage('system', '【交互命令】')
        addMessage('system', '  talk <NPC> - 与NPC对话')
        addMessage('system', '  rumor - 在客栈打听江湖消息')
        addMessage('system', '  shop - 查看商店物品')
        addMessage('system', '  buy <物品ID> - 购买物品')
        addMessage('system', '  sell <物品ID> - 出售物品')
        addMessage('system', '  rest - 在客栈休息恢复HP/MP')
        addMessage('system', '  pickup <物品ID> - 拾取地面物品')
        addMessage('system', '')
        addMessage('system', '【战斗命令】')
        addMessage('system', '  kill <怪物> - 攻击怪物')
        addMessage('system', '  attack/a - 战斗中普通攻击')
        addMessage('system', '  skill <技能ID> - 使用技能')
        addMessage('system', '  flee - 逃跑')
        addMessage('system', '')
        addMessage('system', '【成长命令】')
        addMessage('system', '  skills learn - 查看可学习技能')
        addMessage('system', '  learn <技能ID> - 学习技能')
        addMessage('system', '  train <属性> - 训练属性(力量/敏捷/体质/悟性/根骨)')
        addMessage('system', '  status - 查看状态')
        addMessage('system', '')
        addMessage('system', '【门派命令】')
        addMessage('system', '  faction - 查看门派列表')
        addMessage('system', '  faction join <门派> - 加入门派')
        addMessage('system', '  faction leave - 退出门派')
        addMessage('system', '  faction advance - 门派进阶')
        addMessage('system', '  faction quests - 查看门派任务')
        addMessage('system', '  faction quest accept <ID> - 接取门派任务')
        addMessage('system', '  faction quest complete <ID> - 完成门派任务')
        addMessage('system', '  faction exchange - 查看贡献兑换')
        addMessage('system', '  faction exchange <技能ID> - 贡献兑换技能')
        addMessage('system', '══════════════════════════════')
        break
      case 'status':
        addMessage('system', `等级: ${user.value?.level}, HP: ${user.value?.hp?.current}/${user.value?.hp?.max}, MP: ${user.value?.mp?.current}/${user.value?.mp?.max}, 经验: ${user.value?.exp}, 金币: ${user.value?.gold}`)
        break
      case 'inventory':
        addMessage('system', '背包物品请查看右侧背包面板')
        break
      case 'skills':
        if (args[0] === 'learn') {
          socket.value.emit('list_learnable_skills')
        } else {
          addMessage('system', '已学技能请查看右侧技能面板')
        }
        break
      case 'quests':
        addMessage('system', '进行中任务请查看右侧任务面板')
        break
      case 'rest':
        socket.value.emit('rest')
        break
      case 'rumor':
        socket.value.emit('rumor')
        break
      case 'pickup':
        socket.value.emit('pickup_item', { itemId: args[0], quantity: parseInt(args[1]) || 1 })
        break
      case 'talk':
        socket.value.emit('talk_npc', { npcId: args[0] })
        break
      case 'buy':
      case 'buy_weapon':
      case 'buy_item':
        socket.value.emit('buy_item', { itemId: args[0] })
        break
      case 'sell':
        socket.value.emit('sell_item', { itemId: args[0] })
        break
      case 'shop':
        socket.value.emit('shop_list')
        break
      case 'learn':
        socket.value.emit('learn_skill', { skillId: args[0] })
        break
      case 'train':
        socket.value.emit('train_stat', { stat: args[0] })
        break
      case 'where':
        if (currentRoom.value) {
          addMessage('system', `当前位置: ${currentRoom.value.name}`)
          addMessage('system', `描述: ${currentRoom.value.description}`)
          if (currentRoom.value.exits && currentRoom.value.exits.length > 0) {
            addMessage('system', `出口: ${currentRoom.value.exits.map(e => e.direction + '(' + e.roomName + ')').join(', ')}`)
          }
        } else {
          addMessage('error', '无法获取当前位置信息')
        }
        break
      default:
        addMessage('error', `未知命令: ${cmd}`)
    }
  }
  
  function battleAction(action, skillId = null) {
    if (!socket.value || !battle.value) return
    socket.value.emit('battle_action', {
      battleId: battle.value.battleId,
      action,
      skillId
    })
  }
  
  // 加载游戏配置
  async function loadGameConfig() {
    try {
      const response = await axios.get('/game/config')
      gameConfig.value = response.data.data
      return true
    } catch (error) {
      console.error('加载游戏配置失败:', error)
      return false
    }
  }

  async function refreshCurrentUser() {
    if (!token.value) return null

    try {
      const response = await axios.get('/user/me')
      user.value = response.data.data
      return user.value
    } catch (error) {
      console.error('加载用户信息失败:', error)
      return null
    }
  }

  async function loadInventory() {
    if (!token.value) return []

    try {
      const response = await axios.get('/player/inventory')
      inventory.value = response.data.data
      return inventory.value
    } catch (error) {
      console.error('加载背包失败:', error)
      return []
    }
  }

  async function loadSkills() {
    if (!token.value) return []

    try {
      const response = await axios.get('/player/skills')
      skills.value = response.data.data
      return skills.value
    } catch (error) {
      console.error('加载技能失败:', error)
      return []
    }
  }

  async function loadQuests() {
    if (!token.value) return []

    try {
      const response = await axios.get('/player/quests')
      quests.value = response.data.data
      return quests.value
    } catch (error) {
      console.error('加载任务失败:', error)
      return []
    }
  }

  async function loadPlayerData() {
    if (!token.value) return false

    await Promise.all([
      refreshCurrentUser(),
      loadInventory(),
      loadSkills(),
      loadQuests()
    ])

    // 检查死亡状态
    if (user.value?.status === 'dead' || (user.value?.hp?.current <= 0 && !battle.value)) {
      isDead.value = true
    } else {
      isDead.value = false
    }
    
    return true
  }
  
  function revive() {
    if (socket.value) {
      socket.value.emit('revive')
    }
  }
  
  function allocatePoints(stat) {
    if (socket.value) {
      socket.value.emit('allocate_points', { stat })
    }
  }
  
  function pickupItem(dropId) {
    if (socket.value) {
      socket.value.emit('pickup_item', { itemId: dropId })
    }
  }
  
  function repairItem(inventoryId) {
    if (socket.value) {
      socket.value.emit('repair_item', { inventoryId })
    }
  }
  
  function repairAll() {
    if (socket.value) {
      socket.value.emit('repair_all')
    }
  }
  
  function loadBattleLogs(limit = 20, offset = 0) {
    if (socket.value) {
      socket.value.emit('get_battle_logs', { limit, offset })
    }
  }
  
  function loadBattleLogDetail(logId) {
    if (socket.value) {
      socket.value.emit('get_battle_detail', { battleId: logId })
    }
  }
  
  function advanceFaction() {
    if (socket.value) {
      socket.value.emit('faction_advance')
    }
  }
  
  function loadOnlinePlayers() {
    if (socket.value) {
      socket.value.emit('who')
    }
  }
  
  function requestTrade(targetName) {
    if (socket.value) {
      socket.value.emit('trade_request', { targetName })
    }
  }
  
  function tradeAddItem(tradeId, itemId, quantity = 1) {
    if (socket.value) {
      socket.value.emit('trade_add_item', { tradeId, itemId, quantity })
    }
  }
  
  function tradeSetGold(tradeId, gold) {
    if (socket.value) {
      socket.value.emit('trade_set_gold', { tradeId, gold })
    }
  }
  
  function tradeConfirm(tradeId) {
    if (socket.value) {
      socket.value.emit('trade_confirm', { tradeId })
    }
  }
  
  function tradeCancel(tradeId) {
    if (socket.value) {
      socket.value.emit('trade_cancel', { tradeId })
    }
  }
  
  function tradeRemoveItem(tradeId, itemId) {
    if (socket.value) {
      socket.value.emit('trade_remove_item', { tradeId, itemId })
    }
  }
  
  function sendPvpChallenge(targetName) {
    if (socket.value) {
      socket.value.emit('pvp_challenge', { targetName })
    }
  }
  
  function pvpAccept(challengerName) {
    if (socket.value) {
      socket.value.emit('pvp_accept', { challengerName })
      pvpChallenge.value = null
    }
  }
  
  function pvpDecline(challengerName) {
    if (socket.value) {
      socket.value.emit('pvp_decline', { challengerName })
      pvpChallenge.value = null
    }
  }
  
  function loadAchievements() {
    if (socket.value) {
      socket.value.emit('get_achievements')
    }
  }
  
  function loadForgeRecipes() {
    if (socket.value) {
      socket.value.emit('get_forge_recipes')
    }
  }
  
  function forge(recipeId) {
    if (socket.value) {
      socket.value.emit('forge', { recipeId })
    }
  }
  
  function getTimeInfo() {
    if (socket.value) {
      socket.value.emit('get_time')
    }
  }
  
  // ===== Phase 7-8: 副本 =====
  function loadDungeons() {
    if (socket.value) socket.value.emit('list_dungeons')
  }
  function enterDungeon(dungeonId) {
    if (socket.value) socket.value.emit('enter_dungeon', { dungeonId })
  }
  function dungeonNextWave(dungeonId) {
    if (socket.value) socket.value.emit('dungeon_next_wave', { dungeonId })
  }
  function dungeonWaveComplete(dungeonId) {
    if (socket.value) socket.value.emit('dungeon_wave_complete', { dungeonId })
  }
  function leaveDungeon(dungeonId) {
    if (socket.value) socket.value.emit('leave_dungeon', { dungeonId })
  }

  // ===== P6: 万安塔 (爬塔) =====
  function towerFloorInfo(dungeonId) {
    if (socket.value) socket.value.emit('tower_floor_info', { dungeonId })
  }
  function towerFloorComplete(dungeonId) {
    if (socket.value) socket.value.emit('tower_floor_complete', { dungeonId })
  }
  function towerExit(dungeonId) {
    if (socket.value) socket.value.emit('tower_exit', { dungeonId })
  }

  // ===== P6: 藏经阁 (潜行) =====
  function stealthStart(dungeonId) {
    if (socket.value) socket.value.emit('stealth_start', { dungeonId })
  }
  function stealthMove(battleId) {
    if (socket.value) socket.value.emit('stealth_move', { battleId })
  }

  // ===== P6: 鄱阳湖漂流 (航海) =====
  function driftStart(dungeonId, mode) {
    if (socket.value) socket.value.emit('drift_start', { dungeonId, mode })
  }
  function driftCommand(battleId, command) {
    if (socket.value) socket.value.emit('drift_command', { battleId, command })
  }

  // ===== Phase 7-8: 帮派 =====
  function createGang(name, description) {
    if (socket.value) socket.value.emit('gang_create', { name, description })
  }
  function searchGangs(query) {
    if (socket.value) socket.value.emit('gang_search', { query: query || '' })
  }
  function joinGang(gangName) {
    if (socket.value) socket.value.emit('gang_join', { gangName })
  }
  function leaveGang() {
    if (socket.value) socket.value.emit('gang_leave')
  }
  function loadGangInfo() {
    if (socket.value) socket.value.emit('gang_info')
  }
  function gangDonate(gold, itemId, itemQuantity) {
    if (socket.value) socket.value.emit('gang_donate', { gold, itemId, itemQuantity })
  }
  function gangWithdraw(itemId, quantity) {
    if (socket.value) socket.value.emit('gang_withdraw', { itemId, quantity })
  }
  function sendGangChat(content) {
    if (socket.value) socket.value.emit('chat_gang', { content })
  }

  // ===== Phase 7-8: 拍卖行 =====
  function searchAuctions(query) {
    if (socket.value) socket.value.emit('auction_search', { query: query || '' })
  }
  function loadMyAuctions() {
    if (socket.value) socket.value.emit('auction_my_listings')
  }
  function createAuction(itemId, quantity, price, duration) {
    if (socket.value) socket.value.emit('auction_create', { itemId, quantity, price, duration: duration || 48 })
  }
  function buyAuction(listingId) {
    if (socket.value) socket.value.emit('auction_buy', { listingId })
  }
  function cancelAuction(listingId) {
    if (socket.value) socket.value.emit('auction_cancel', { listingId })
  }

  // ===== Phase 7-8: 生活技能 =====
  function loadGatheringNodes() {
    if (socket.value) socket.value.emit('list_gathering_nodes')
  }
  function gather(nodeId) {
    if (socket.value) socket.value.emit('gather', { nodeId })
  }
  function loadAlchemyRecipes() {
    if (socket.value) socket.value.emit('list_alchemy_recipes')
  }
  function alchemy(recipeId) {
    if (socket.value) socket.value.emit('alchemy', { recipeId })
  }
  function loadCookingRecipes() {
    if (socket.value) socket.value.emit('list_cooking_recipes')
  }
  function cooking(recipeId) {
    if (socket.value) socket.value.emit('cooking', { recipeId })
  }

  // ===== Phase 7-8: 每日活跃 =====
  function loadDailyStatus() {
    if (socket.value) socket.value.emit('get_daily_status')
  }
  function dailyCheckin() {
    if (socket.value) socket.value.emit('daily_checkin')
  }
  function claimDailyTask(taskId) {
    if (socket.value) socket.value.emit('claim_daily_task', { taskId })
  }
  function claimActivityReward(level) {
    if (socket.value) socket.value.emit('claim_activity_reward', { level })
  }
  
  return {
    // 状态
    token,
    user,
    socket,
    connected,
    currentRoom,
    messages,
    players,
    battle,
    inventory,
    skills,
    quests,
    gameConfig,
    isDead,
    roomDrops,
    battleLogList,
    battleLogDetail,
    onlinePlayers,
    activeTrade,
    pvpChallenge,
    npcDialog,
    questProgress,
    achievements,
    forgeRecipes,
    timeInfo,
    // Phase 7-8 状态
    dungeons,
    currentDungeon,
    dungeonWave,
    // P6 新副本状态
    towerState,
    stealthState,
    driftState,
    gangs,
    myGang,
    auctions,
    gatheringNodes,
    alchemyRecipes,
    cookingRecipes,
    dailyStatus,
    activityRewards,
    // 计算属性
    isLoggedIn,
    isGM,
    isAdmin,
    // 方法
    login,
    register,
    checkAuth,
    logout,
    connectSocket,
    addMessage,
    sendCommand,
    battleAction,
    loadGameConfig,
    refreshCurrentUser,
    loadInventory,
    loadSkills,
    loadQuests,
    loadPlayerData,
    revive,
    allocatePoints,
    pickupItem,
    repairItem,
    repairAll,
    loadBattleLogs,
    loadBattleLogDetail,
    advanceFaction,
    loadOnlinePlayers,
    requestTrade,
    tradeAddItem,
    tradeSetGold,
    tradeConfirm,
    tradeCancel,
    tradeRemoveItem,
    sendPvpChallenge,
    pvpAccept,
    pvpDecline,
    loadAchievements,
    loadForgeRecipes,
    forge,
    getTimeInfo,
    // Phase 7-8 方法
    loadDungeons,
    enterDungeon,
    dungeonNextWave,
    dungeonWaveComplete,
    leaveDungeon,
    // P6 新副本方法
    towerFloorInfo,
    towerFloorComplete,
    towerExit,
    stealthStart,
    stealthMove,
    driftStart,
    driftCommand,
    createGang,
    searchGangs,
    joinGang,
    leaveGang,
    loadGangInfo,
    gangDonate,
    gangWithdraw,
    sendGangChat,
    searchAuctions,
    loadMyAuctions,
    createAuction,
    buyAuction,
    cancelAuction,
    loadGatheringNodes,
    gather,
    loadAlchemyRecipes,
    alchemy,
    loadCookingRecipes,
    cooking,
    loadDailyStatus,
    dailyCheckin,
    claimDailyTask,
    claimActivityReward
  }
})
