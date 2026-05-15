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
    localStorage.removeItem('token')
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
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
    
    socket.value.on('disconnect', () => {
      connected.value = false
      console.log('Socket disconnected')
      addMessage('error', '与服务器断开连接')
    })
    
    socket.value.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      addMessage('error', '连接服务器失败: ' + error.message)
    })
    
    socket.value.on('welcome', (data) => {
      console.log('Welcome data:', data)
      addMessage('system', data.message)
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
      if (room) {
        addMessage('room', `【${room.name}】${room.description}`)
        if (room.exits && room.exits.length > 0) {
          addMessage('room', `出口: ${room.exits.map(e => e.direction + '(' + e.roomName + ')').join(', ')}`)
        }
      }
    })
    
    socket.value.on('chat_message', (data) => {
      addMessage(data.channel, `[${data.sender}] ${data.content}`)
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
      addMessage('system', '战斗结束！')
      if (data.result?.mutualDefeat) {
        addMessage('battle', '双方同归于尽。')
      }
      if (data.rewards) {
        addMessage('system', `获得 ${data.rewards.expGained} 经验, ${data.rewards.goldGained} 金币`)
      }
      await Promise.all([refreshCurrentUser(), loadInventory(), loadQuests()])
    })
    
    socket.value.on('error', (data) => {
      addMessage('error', data.message)
    })
    
    socket.value.on('rest_complete', async (data) => {
      addMessage('success', '休息完毕，精力充沛！')
      await refreshCurrentUser()
    })
    
    socket.value.on('npc_dialog', (data) => {
      addMessage('npc', `【${data.npc.name}】${data.message}`)
      if (data.roomServices && data.roomServices.length > 0) {
        addMessage('system', `可用服务: ${data.roomServices.join(', ')}`)
      }
    })
    
    socket.value.on('shop_items', (data) => {
      addMessage('shop', `【${data.roomName}商店】`)
      data.items.forEach(item => {
        addMessage('shop', `  ${item.name} - ${item.price}金币 - ${item.description}`)
      })
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
      addMessage('success', `使用了 ${data.item.name}`)
      await Promise.all([refreshCurrentUser(), loadInventory()])
    })

    socket.value.on('item_equipped', async (data) => {
      addMessage('success', `${data.item.name} 已装备到 ${data.slot} 槽位`)
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
        socket.value.emit('use_item', { inventoryId: args[0] })
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
        } else {
          socket.value.emit('list_factions')
        }
        break
      case 'help':
        addMessage('system', '══════════════════════════════')
        addMessage('system', '【移动命令】')
        addMessage('system', '  look/l - 查看当前房间')
        addMessage('system', '  go/move <方向> - 移动(n/s/e/w/up/down/in/out)')
        addMessage('system', '  where - 查看当前位置详情')
        addMessage('system', '')
        addMessage('system', '【交互命令】')
        addMessage('system', '  talk <NPC> - 与NPC对话')
        addMessage('system', '  shop - 查看商店物品')
        addMessage('system', '  buy <物品ID> - 购买物品')
        addMessage('system', '  sell <物品ID> - 出售物品')
        addMessage('system', '  rest - 在客栈休息恢复HP/MP')
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
        addMessage('system', '  train <属性> - 训练属性(strength/dexterity/constitution/intelligence)')
        addMessage('system', '  status - 查看状态')
        addMessage('system', '')
        addMessage('system', '【门派命令】')
        addMessage('system', '  faction - 查看门派列表')
        addMessage('system', '  faction join <门派> - 加入门派')
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
      case 'talk':
        socket.value.emit('talk_npc', { npcId: args[0] })
        break
      case 'buy':
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

    return true
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
    loadPlayerData
  }
})
