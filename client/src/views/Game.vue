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
      <!-- NPC任务对话框 -->
      
      <!-- 地图弹窗 -->
      <div class="quest-overlay" v-if="showMap" @click.self="showMap = false">
        <div class="quest-dialog" style="max-width: 420px;">
          <div class="quest-dialog-title">🗺️ 当前位置</div>
          <div class="quest-dialog-message">
            <div style="font-size: 1.1em; margin-bottom: 8px;">📍 {{ gameStore.currentRoom?.name || gameStore.currentRoom?.id || '未知' }}</div>
            <div style="color: #aaa; font-size: 0.85em; margin-bottom: 12px;">{{ gameStore.currentRoom?.description || '' }}</div>
          </div>
          <!-- 出口 -->
          <div class="quest-offer-list">
            <div class="quest-offer-title">🚪 可移动方向</div>
            <div v-if="gameStore.currentRoom?.exits" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <button v-for="(target, dir) in gameStore.currentRoom.exits" :key="dir"
                class="quick-btn map-dir-btn"
                @click="gameStore.sendCommand('go ' + dir); showMap = false">
                {{ getDirectionEmoji(dir) }} {{ dirDisplayName(dir) }}
                <span style="font-size:0.7em;color:#888;display:block">{{ roomDisplayName(target) }}</span>
              </button>
            </div>
            <div v-else class="empty-hint">此处无路可走</div>
          </div>
          <button class="quest-close-btn" @click="showMap = false">关闭</button>
        </div>
      </div>

<div class="quest-overlay" v-if="gameStore.npcDialog">
        <div class="quest-dialog">
          <div class="quest-dialog-title">【{{ gameStore.npcDialog.npc.name }}】</div>
          <div class="quest-dialog-message">{{ gameStore.npcDialog.message }}</div>
          <!-- NPC服务按钮 -->
          <div v-if="gameStore.npcDialog.npc?.services?.length" class="npc-services-row">
            <button v-for="svc in gameStore.npcDialog.npc.services" :key="svc"
              class="npc-service-btn"
              @click="useNPCServices(svc)">
              {{ svc === 'shop' || svc === 'buy_item' || svc === 'buy_weapon' || svc === 'buy_armor' ? '🏪 商店' :
                 svc === 'repair' ? '🔧 修理' :
                 svc === 'sell_item' ? '💰 出售' :
                 svc === 'train' || svc === 'learn_skill' ? '📚 学习' :
                 svc === 'rest' ? '🛏️ 休息' :
                 svc === 'rumor' ? '💬 打听' :
                 svc === 'forge_weapon' ? '🔨 锻造' :
                 svc === 'faction' || svc === 'exchange' ? '⚡ 门派' :
                 svc === 'teleport' ? '🚗 传送' :
                 '🔹 ' + svc }}
            </button>
          </div>
          <!-- 传送目的地 -->
          <div v-if="gameStore.npcDialog.npc?.teleportDestinations?.length" class="quest-offer-list">
            <div class="quest-offer-title teleport">🚗 选择目的地：</div>
            <div v-for="dest in gameStore.npcDialog.npc.teleportDestinations" :key="dest.id"
              class="quest-offer-item"
              style="border-left: 3px solid #6366f1;">
              <div class="quest-offer-info">
                <div class="quest-offer-name">{{ dest.name }}</div>
                <div class="quest-offer-rewards">💰 {{ dest.cost }} 金币</div>
              </div>
              <button class="quest-accept-btn teleport-btn"
                @click="doTeleport(gameStore.npcDialog.npc.id, dest.id)">前往</button>
            </div>
          </div>
          <!-- 可交任务 -->
          <div v-if="gameStore.npcDialog.completableQuests?.length" class="quest-offer-list">
            <div class="quest-offer-title completable">✅ 可交任务：</div>
            <div v-for="quest in gameStore.npcDialog.completableQuests" :key="'comp-'+quest.id" class="quest-offer-item completable">
              <div class="quest-offer-info">
                <div class="quest-offer-name">{{ quest.name }}</div>
                <div class="quest-offer-desc">{{ quest.description }}</div>
                <div class="quest-offer-rewards">奖励: {{ quest.rewards.exp ? quest.rewards.exp + '经验 ' : '' }}{{ quest.rewards.gold ? quest.rewards.gold + '金币' : '' }}{{ quest.rewards.items?.length ? ' +物品' : '' }}</div>
              </div>
              <button class="quest-accept-btn complete-btn" @click="completeQuest(quest.id)">完成</button>
            </div>
          </div>
          <!-- 已接任务 -->
          <div v-if="gameStore.npcDialog.acceptedQuests?.length" class="quest-offer-list">
            <div class="quest-offer-title accepted">⏳ 已接任务：</div>
            <div v-for="quest in gameStore.npcDialog.acceptedQuests" :key="'acc-'+quest.id" class="quest-offer-item accepted">
              <div class="quest-offer-info">
                <div class="quest-offer-name">{{ quest.name }}</div>
                <div class="quest-offer-desc">状态: {{ quest.status === 'in_progress' ? '进行中' : '已接取' }}</div>
              </div>
            </div>
          </div>
          <!-- 可接任务 -->
          <div v-if="gameStore.npcDialog.availableQuests.length" class="quest-offer-list">
            <div class="quest-offer-title">📋 可接任务：</div>
            <div
              v-for="quest in gameStore.npcDialog.availableQuests"
              :key="quest.id"
              class="quest-offer-item"
            >
              <div class="quest-offer-info">
                <div class="quest-offer-name">
                  <span :class="{ 'quest-main': quest.type === 'main', 'quest-side': quest.type === 'side', 'quest-daily': quest.type === 'daily', 'quest-faction': quest.type === 'faction_entry' || quest.type === 'faction_rank_up' }">
                    {{ quest.type === 'main' ? '【主线】' : quest.type === 'daily' ? '【日常】' : quest.type === 'faction_entry' ? '【入门考核】' : quest.type === 'faction_rank_up' ? '【门派试炼】' : '【支线】' }}
                  </span>
                  {{ quest.name }}
                </div>
                <div class="quest-offer-desc">{{ quest.description }}</div>
                <div class="quest-offer-rewards">
                  奖励: {{ quest.rewards.exp ? quest.rewards.exp + '经验 ' : '' }}{{ quest.rewards.gold ? quest.rewards.gold + '金币' : '' }}{{ quest.rewards.items?.length ? ' +物品' : '' }}
                </div>
                <div v-if="!quest.prerequisitesMet" class="quest-offer-locked">🔒 需要先完成前置任务: {{ quest.missingPrereqs?.join('、') || '未知' }}</div>
              </div>
              <button
                v-if="quest.prerequisitesMet"
                class="quest-accept-btn"
                @click="acceptQuest(quest.id)"
              >接受</button>
            </div>
          </div>
          <div v-if="!gameStore.npcDialog.availableQuests.length && !gameStore.npcDialog.acceptedQuests?.length && !gameStore.npcDialog.completableQuests?.length && !gameStore.npcDialog.npc?.teleportDestinations?.length" class="quest-offer-empty">该NPC暂无适合你的任务</div>
          <!-- 门派贡献兑换 -->
          <div v-if="gameStore.npcDialog.factionExchangeInfo" class="faction-exchange-section">
            <div v-if="gameStore.npcDialog.factionExchangeInfo.noFaction" class="exchange-hint">
              ⚠ 你需要先加入门派才能使用贡献兑换。
            </div>
            <div v-else class="exchange-content">
              <div class="exchange-header">
                ⚡ 门派贡献兑换 (贡献: {{ gameStore.npcDialog.factionExchangeInfo.myContribution }} | 等级: {{ gameStore.npcDialog.factionExchangeInfo.myRank }})
              </div>
              <div v-if="gameStore.npcDialog.factionExchangeInfo.skills.length === 0" class="exchange-empty">
                暂无可兑换技能（等级不足或已全部学会）
              </div>
              <div v-for="skill in gameStore.npcDialog.factionExchangeInfo.skills" :key="skill.id" class="quest-offer-item">
                <div class="quest-offer-info">
                  <div class="quest-offer-name">{{ skill.name }}</div>
                  <div class="quest-offer-desc">{{ skill.description }}</div>
                  <div class="quest-offer-rewards">消耗 {{ skill.contributionCost }} 门派贡献</div>
                </div>
                <button class="quest-accept-btn exchange-btn" @click="exchangeSkill(skill.id)">兑换</button>
              </div>
            </div>
          </div>
          <button class="quest-close-btn" @click="gameStore.npcDialog = null">关闭</button>
        </div>
      </div>

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
      
      <!-- 交易面板 -->
      <div class="trade-overlay" v-if="gameStore.activeTrade">
        <div class="trade-panel">
          <div class="trade-title">🤝 交易 - {{ gameStore.activeTrade.partner }}</div>
          <div class="trade-body">
            <div class="trade-side">
              <div class="trade-side-title">你的出价</div>
              <div class="trade-items">
                <div v-for="item in myTradeOffer.items" :key="item.itemId" class="trade-offer-item">
                  {{ item.itemName }} x{{ item.quantity }}
                  <button class="trade-remove-btn" @click="tradeRemoveItem(gameStore.activeTrade.tradeId, item.itemId)">✕</button>
                </div>
                <div v-if="myTradeOffer.gold > 0" class="trade-offer-gold">💰 {{ myTradeOffer.gold }} 金币</div>
              </div>
              <div class="trade-gold-input">
                <input v-model.number="tradeGoldInput" type="number" min="0" placeholder="金币" class="trade-gold-field" />
                <button class="trade-btn" @click="tradeSetGold(gameStore.activeTrade.tradeId, tradeGoldInput)">设置金币</button>
              </div>
              <div class="trade-add-section">
                <select v-model="tradeItemSelect" class="trade-item-select">
                  <option value="">选择物品...</option>
                  <option v-for="item in tradeableItems" :key="item.itemId" :value="item.itemId">
                    {{ item.name || item.itemId }} x{{ item.quantity }}
                  </option>
                </select>
                <button class="trade-btn" @click="addTradeItem" :disabled="!tradeItemSelect">添加</button>
              </div>
            </div>
            <div class="trade-side">
              <div class="trade-side-title">对方出价</div>
              <div class="trade-items">
                <div v-for="item in partnerTradeOffer.items" :key="item.itemId" class="trade-offer-item">
                  {{ item.itemName }} x{{ item.quantity }}
                </div>
                <div v-if="partnerTradeOffer.gold > 0" class="trade-offer-gold">💰 {{ partnerTradeOffer.gold }} 金币</div>
              </div>
            </div>
          </div>
          <div class="trade-actions">
            <button class="trade-confirm-btn" @click="tradeConfirm(gameStore.activeTrade.tradeId)" :disabled="myTradeConfirmed">
              {{ myTradeConfirmed ? '✅ 已确认' : '✔️ 确认交易' }}
            </button>
            <button class="trade-cancel-btn" @click="tradeCancel(gameStore.activeTrade.tradeId)">取消</button>
          </div>
        </div>
      </div>
      
      <!-- PVP挑战通知 -->
      <div class="pvp-challenge-overlay" v-if="gameStore.pvpChallenge">
        <div class="pvp-challenge-panel">
          <div class="pvp-challenge-title">⚔️ PVP挑战</div>
          <div class="pvp-challenge-info">
            {{ gameStore.pvpChallenge.challengerName }}(Lv{{ gameStore.pvpChallenge.challengerLevel }}) 向你发起了挑战！
          </div>
          <div class="pvp-challenge-actions">
            <button class="pvp-accept-btn" @click="pvpAccept(gameStore.pvpChallenge.challengerName)">⚔️ 应战</button>
            <button class="pvp-decline-btn" @click="pvpDecline(gameStore.pvpChallenge.challengerName)">拒绝</button>
          </div>
        </div>
      </div>
      
      <!-- 房间信息 -->
      <div class="room-info" v-if="gameStore.currentRoom && !isDead">
        <div class="room-name">{{ gameStore.currentRoom.name }}</div>
        <div class="room-description">{{ gameStore.currentRoom.description }}</div>
        
        <!-- 天气/时间信息 -->
        <div class="time-weather" v-if="gameStore.timeInfo">
          <span class="time-display">🕐 {{ gameStore.timeInfo.timeStr }} {{ gameStore.timeInfo.periodName }}</span>
          <span class="weather-display">{{ gameStore.timeInfo.weather?.name }} - {{ gameStore.timeInfo.weather?.description }}</span>
        </div>
        
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
                🧑 {{ npc.name }}<span v-if="hasNpcQuest(npc)" class="npc-quest-icon" :class="{ 'quest-completed': isNpcQuestDone(npc) }">{{ isNpcQuestDone(npc) ? '✅' : '❗' }}</span>
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
        <select v-model="chatChannel" class="chat-channel-select" v-if="showChatMode">
          <option value="world">世界</option>
          <option value="room">区域</option>
          <option value="private">私聊</option>
        </select>
        <input 
          v-model="command" 
          type="text" 
          :placeholder="commandPlaceholder" 
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
        <button class="quick-btn" @click="showChatMode = !showChatMode">💬 {{ showChatMode ? '命令' : '聊天' }}</button>
        <button class="quick-btn" @click="quickCommand('look')">👁️ 查看</button>
        <button class="quick-btn" @click="showMap = true">🗺️ 地图</button>
        <button class="quick-btn" @click="quickCommand('status')">📊 状态</button>
      </div>
      <div class="quick-actions">
        <button class="quick-btn" @click="quickCommand('help')">❓ 帮助</button>
        <button class="quick-btn" @click="quickCommand('inventory')">🎒 背包</button>
        <button class="quick-btn" @click="quickCommand('skills')">⚔️ 技能</button>
        <button class="quick-btn" @click="quickCommand('quests')">📜 任务</button>
        <button v-if="hasFactionNpc" class="quick-btn" @click="quickCommand('faction')">🏯 门派</button>
      </div>
    </div>
    
    <!-- 右侧面板 - 菜单 -->
    <div class="right-panel">
      <div class="menu-tabs">
        <button class="menu-tab" :class="{ active: activeTab === 'inventory' }" @click="activeTab = 'inventory'">背包</button>
        <button class="menu-tab" :class="{ active: activeTab === 'skills' }" @click="activeTab = 'skills'">技能</button>
        <button class="menu-tab" :class="{ active: activeTab === 'quests' }" @click="activeTab = 'quests'">任务</button>
        <button class="menu-tab" :class="{ active: activeTab === 'battlelog' }" @click="activeTab = 'battlelog'">战报</button>
        <button class="menu-tab" :class="{ active: activeTab === 'online' }" @click="activeTab = 'online'; loadOnlinePlayers()">在线</button>
        <button class="menu-tab" :class="{ active: activeTab === 'achievements' }" @click="activeTab = 'achievements'; loadAchievements()">成就</button>
        <button class="menu-tab" :class="{ active: activeTab === 'forge' }" @click="activeTab = 'forge'; loadForgeRecipes()">锻造</button>
        <button class="menu-tab" :class="{ active: activeTab === 'dungeons' }" @click="activeTab = 'dungeons'; gameStore.loadDungeons()">副本</button>
        <button class="menu-tab" :class="{ active: activeTab === 'gangs' }" @click="activeTab = 'gangs'; gameStore.searchGangs(''); gameStore.loadGangInfo()">帮派</button>
        <button class="menu-tab" :class="{ active: activeTab === 'auction' }" @click="activeTab = 'auction'; gameStore.searchAuctions(''); gameStore.loadMyAuctions()">拍卖</button>
        <button class="menu-tab" :class="{ active: activeTab === 'life' }" @click="activeTab = 'life'; gameStore.loadGatheringNodes(); gameStore.loadAlchemyRecipes(); gameStore.loadCookingRecipes()">生活</button>
        <button class="menu-tab" :class="{ active: activeTab === 'daily' }" @click="activeTab = 'daily'; gameStore.loadDailyStatus(); gameStore.loadDailyV2Status()">每日</button>
        <button v-if="currentRoomServices.some(s => ['shop','buy_item','buy_weapon','buy_armor','sell_item'].includes(s))" class="menu-tab" :class="{ active: activeTab === 'shop' }" @click="activeTab = 'shop'; loadShopItems()">商店</button>
      </div>
      
      <div class="menu-content">
        <!-- 背包 -->
        <div v-if="activeTab === 'inventory'">
          <!-- 装备槽位 -->
          <div class="equipment-slots">
            <div class="equip-slots-title">⚔️ 装备栏</div>
            <div v-for="slot in equipmentSlots" :key="slot.key" class="equip-slot-row">
              <span class="equip-slot-label">{{ slot.label }}</span>
              <span class="equip-slot-item" :class="{ empty: !slot.item }">{{ slot.item ? getItemName(slot.item.itemId) : '空' }}</span>
              <span v-if="slot.item" class="equip-slot-stats">{{ getItemStats(slot.item.itemId) }}</span>
            </div>
          </div>
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
              <button v-if="isEquipment(item.itemId) && item.isEquipped" class="item-btn unequip-btn" @click="unequipItem(item)">卸下</button>
              <button v-if="isEquipment(item.itemId) && (item.durability?.current || 0) < (item.durability?.max || 100)" class="item-btn repair-btn" @click="repairItem(item._id)">修复</button>
              <button v-if="currentRoomServices.some(s => ['shop','buy_item','buy_weapon','buy_armor','sell_item'].includes(s))" class="item-btn sell-btn" @click="sellItem(item)">出售</button>
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
            <button v-if="quest.status === 'completed' && !quest.rewardClaimed && !needNpcHandIn(quest.questId)" class="quest-reward-btn" @click="claimQuestReward(quest.questId)">领取奖励</button>
            <span v-if="quest.status === 'completed' && !quest.rewardClaimed && needNpcHandIn(quest.questId)" class="hand-in-hint">📍 需要找 {{ getHandInNpcName(quest.questId) }} 交接任务</span>
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
                <span class="log-result" :class="battleLogWon(log) ? 'victory' : 'defeat'">
                  {{ battleLogWon(log) ? '胜' : '败' }}
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

        <!-- 在线玩家 -->
        <div v-if="activeTab === 'online'">
          <button class="item-btn" @click="loadOnlinePlayers" style="margin-bottom:8px">刷新列表</button>
          <div class="online-count">当前在线: {{ gameStore.onlinePlayers.length }} 人</div>
          <div v-for="player in gameStore.onlinePlayers" :key="player.name" class="online-player-item">
            <div class="online-player-header">
              <span class="online-player-name">{{ player.name }}</span>
              <span class="online-player-level">Lv{{ player.level }}</span>
              <button v-if="player.name !== gameStore.user?.characterName" class="trade-request-btn" @click="requestTrade(player.name)">交易</button>
              <button v-if="player.name !== gameStore.user?.characterName" class="pvp-btn" @click="pvpChallenge(player.name)">⚔️</button>
            </div>
            <div class="online-player-meta">
              <span v-if="player.faction" class="online-player-faction">{{ getFactionName(player.faction) }}</span>
              <span class="online-player-room">{{ roomDisplayName(player.location?.roomId || '') }}</span>
            </div>
          </div>
          <div v-if="!gameStore.onlinePlayers.length" class="empty-hint">暂无其他玩家在线</div>
        </div>

        <!-- 成就 -->
        <div v-if="activeTab === 'achievements'">
          <div v-for="ach in gameStore.achievements.available" :key="ach.id" class="achievement-item" :class="{ achieved: isAchieved(ach.id) }">
            <div class="ach-header">
              <span class="ach-icon">{{ isAchieved(ach.id) ? '🏆' : '🔒' }}</span>
              <span class="ach-name">{{ ach.name }}</span>
            </div>
            <div class="ach-desc">{{ ach.description }}</div>
            <div class="ach-rewards" v-if="ach.rewards">
              <span v-if="ach.rewards.exp">经验+{{ ach.rewards.exp }}</span>
              <span v-if="ach.rewards.gold">金币+{{ ach.rewards.gold }}</span>
              <span v-if="ach.rewards.title" class="ach-title">称号: {{ ach.rewards.title }}</span>
            </div>
          </div>
        </div>

        <!-- 锻造 -->
        <div v-if="activeTab === 'forge'">
          <div v-for="recipe in gameStore.forgeRecipes" :key="recipe.id" class="forge-recipe-item">
            <div class="forge-header">
              <span class="forge-name">{{ recipe.name }}</span>
              <span class="forge-rate">成功率 {{ Math.round((recipe.successRate || 1) * 100) }}%</span>
            </div>
            <div class="forge-desc">{{ recipe.description }}</div>
            <div class="forge-cost">
              <span v-if="recipe.cost?.gold">💰 {{ recipe.cost.gold }} 金币</span>
              <span v-for="mat in (recipe.cost?.materials || [])" :key="mat.itemId">
                {{ mat.itemId }} x{{ mat.quantity }}
              </span>
            </div>
            <button class="forge-btn" @click="forge(recipe.id)">锻造</button>
          </div>
          <div v-if="!gameStore.forgeRecipes.length" class="empty-hint">暂无锻造配方</div>
        </div>

        <!-- 副本 -->
        <div v-if="activeTab === 'dungeons'">
          <!-- ===== 万安塔(爬塔)中 ===== -->
          <div v-if="gameStore.towerState" class="dungeon-active">
            <div class="dungeon-header">
              <span class="dungeon-name">🏯 万安塔</span>
              <span class="dungeon-wave">第 {{ gameStore.towerState.floor }}/{{ gameStore.towerState.totalFloors }} 层</span>
            </div>
            <div class="dungeon-desc">{{ gameStore.towerState.description }}</div>
            <div class="dungeon-wave-info">
              <div class="dungeon-monster" v-for="m in (gameStore.towerState.monsters || [])" :key="m.monsterId">
                <span class="monster-name">{{ m.monsterId }}</span>
                <span class="monster-lv">×{{ m.count }}</span>
              </div>
            </div>
            <div class="dungeon-meta">
              <span>当前累积奖励：经验+{{ gameStore.towerState.currentReward?.accumulatedExp || 0 }}</span>
            </div>
            <div class="dungeon-actions">
              <button class="forge-btn" @click="gameStore.towerFloorComplete('dungeon_wanan_tower')">挑战本层</button>
              <button class="forge-btn" style="background:#d4a017" @click="gameStore.towerExit('dungeon_wanan_tower')">🔔 敲锣收功</button>
            </div>
          </div>

          <!-- ===== 藏经阁(潜行)中 ===== -->
          <div v-else-if="gameStore.stealthState" class="dungeon-active">
            <div class="dungeon-header">
              <span class="dungeon-name">📜 藏经阁</span>
              <span class="dungeon-wave">第 {{ gameStore.stealthState.layer?.number || 1 }} 层</span>
            </div>
            <div class="dungeon-desc">{{ gameStore.stealthState.layer?.description }}</div>
            <div class="dungeon-wave-info">
              <div>📍 位置：{{ gameStore.stealthState.position || 0 }}/{{ gameStore.stealthState.layer?.rooms }}</div>
              <div>👁 看破：{{ gameStore.stealthState.detections || 0 }}/{{ gameStore.stealthState.maxDetections }}</div>
              <div>⭐ 积分：{{ gameStore.stealthState.score || 0 }}</div>
            </div>
            <div class="dungeon-actions">
              <button class="forge-btn" @click="gameStore.stealthMove(gameStore.stealthState.battleId)">前进一步</button>
            </div>
          </div>

          <!-- ===== 鄱阳湖漂流(航海)中 ===== -->
          <div v-else-if="gameStore.driftState" class="dungeon-active">
            <div class="dungeon-header">
              <span class="dungeon-name">⛵ 鄱阳湖漂流</span>
              <span class="dungeon-wave">{{ gameStore.driftState.mode?.name }}</span>
            </div>
            <div class="dungeon-wave-info">
              <div>📍 航程：{{ gameStore.driftState.distance }}/{{ gameStore.driftState.maxDistance }} 里</div>
              <div v-if="gameStore.driftState.anchored">⚓ 已下锚</div>
            </div>
            <div class="dungeon-actions" style="flex-wrap:wrap">
              <button class="forge-btn" @click="gameStore.driftCommand(gameStore.driftState.battleId, 'shengfan')">⛵ 升帆</button>
              <button class="forge-btn" @click="gameStore.driftCommand(gameStore.driftState.battleId, 'huadong')">🛶 划桨</button>
              <button class="forge-btn" @click="gameStore.driftCommand(gameStore.driftState.battleId, 'xiamao')">⚓ 下锚</button>
              <button class="forge-btn" @click="gameStore.driftCommand(gameStore.driftState.battleId, 'fanhang')" :disabled="!gameStore.driftState.anchored">🏠 返航</button>
              <button class="forge-btn" @click="gameStore.driftCommand(gameStore.driftState.battleId, 'tancha')">🔍 探查</button>
              <button class="forge-btn" style="background:#888" @click="gameStore.driftCommand(gameStore.driftState.battleId, 'jiangfan')">降帆</button>
              <button class="forge-btn" style="background:#888" @click="gameStore.driftCommand(gameStore.driftState.battleId, 'tingchuan')">停船</button>
            </div>
          </div>

          <!-- ===== 旧副本(试炼/探索/BOSS)中 ===== -->
          <div v-else-if="gameStore.currentDungeon" class="dungeon-active">
            <div class="dungeon-header">
              <span class="dungeon-name">⚔️ {{ gameStore.currentDungeon.dungeonName }}</span>
              <span class="dungeon-wave" v-if="gameStore.currentDungeon.currentWave">第 {{ gameStore.currentDungeon.currentWave }}/{{ gameStore.currentDungeon.totalWaves }} 波</span>
            </div>
            <div v-if="gameStore.dungeonWave" class="dungeon-wave-info">
              <div class="dungeon-monster" v-for="m in (gameStore.dungeonWave.monsters || [])" :key="m.id">
                <span class="monster-name">{{ m.name }}</span>
                <span class="monster-lv">Lv{{ m.level }}</span>
              </div>
            </div>
            <div class="dungeon-actions">
              <button v-if="gameStore.currentDungeon.currentWave && gameStore.dungeonWave" class="forge-btn" @click="gameStore.dungeonWaveComplete(gameStore.currentDungeon.dungeonId)">击败当前波次</button>
              <button v-if="!gameStore.dungeonWave && gameStore.currentDungeon.currentWave" class="forge-btn" @click="gameStore.dungeonNextWave(gameStore.currentDungeon.dungeonId)">下一波</button>
              <button class="btn btn-secondary" @click="gameStore.leaveDungeon(gameStore.currentDungeon.dungeonId)">退出副本</button>
            </div>
          </div>

          <!-- ===== 副本列表 ===== -->
          <div v-else>
            <div v-for="d in gameStore.dungeons" :key="d.id" class="dungeon-item">
              <div class="dungeon-header">
                <span class="dungeon-name">{{ d.name }}</span>
                <span class="dungeon-type">{{ typeLabel(d.type) }}</span>
              </div>
              <div class="dungeon-desc">{{ d.description }}</div>
              <div class="dungeon-meta">
                <span v-if="d.requireLevel">需等级 {{ d.requireLevel }}</span>
                <span v-if="d.dailyLimit > 0">每日 {{ d.dailyLimit }} 次</span>
                <span v-if="d.onCooldown" style="color:#f66">冷却 {{ d.cooldownRemaining }}分钟</span>
              </div>
              <button class="forge-btn" @click="enterDungeonByType(d)" :disabled="d.onCooldown">{{ d.onCooldown ? '冷却中...' : '进入副本' }}</button>
            </div>
            <div v-if="!gameStore.dungeons.length" class="empty-hint">暂无副本</div>
          </div>
        </div>

        <!-- 帮派 -->
        <div v-if="activeTab === 'gangs'">
          <!-- 已加入帮派 -->
          <div v-if="gameStore.myGang" class="gang-info">
            <div class="gang-name">🏠 {{ gameStore.myGang.name }}</div>
            <div class="gang-desc" v-if="gameStore.myGang.description">{{ gameStore.myGang.description }}</div>
            <div class="gang-stats">
              <span>等级 {{ gameStore.myGang.level || 1 }}</span>
              <span>成员 {{ gameStore.myGang.memberCount }}人</span>
              <span>资金 {{ gameStore.myGang.funds || 0 }}</span>
            </div>
            <div class="gang-member-section">
              <div class="section-title">成员</div>
              <div v-for="m in (gameStore.myGang.members || [])" :key="m.userId" class="gang-member">
                <span>{{ m.name || m.userId }}</span>
                <span class="gang-role">{{ m.role }}</span>
                <span v-if="m.contribution !== undefined">贡献 {{ m.contribution }}</span>
              </div>
            </div>
            <div class="gang-actions">
              <input v-model="gangDonateGold" type="number" min="0" placeholder="金币" class="gang-input" />
              <button class="forge-btn" @click="gangDoDonate">捐献</button>
              <button class="btn btn-secondary" @click="gameStore.leaveGang()">退出帮派</button>
            </div>
            <!-- 帮派仓库 -->
            <div v-if="gameStore.myGang.warehouse && gameStore.myGang.warehouse.length" class="gang-warehouse">
              <div class="section-title">帮派仓库</div>
              <div v-for="item in gameStore.myGang.warehouse" :key="item.itemId" class="gang-wh-item">
                <span>{{ item.name || item.itemId }} x{{ item.quantity }}</span>
                <button class="forge-btn small" @click="gameStore.gangWithdraw(item.itemId, 1)">取出</button>
              </div>
            </div>
          </div>
          <!-- 未加入帮派 -->
          <div v-else>
            <div class="gang-search">
              <input v-model="gangSearchQuery" placeholder="搜索帮派..." class="gang-input" @keyup.enter="gameStore.searchGangs(gangSearchQuery)" />
              <button class="forge-btn" @click="gameStore.searchGangs(gangSearchQuery)">搜索</button>
            </div>
            <div v-if="gameStore.gangs.length" class="gang-list">
              <div v-for="g in gameStore.gangs" :key="g.id || g.name" class="gang-item">
                <div class="gang-name">{{ g.name }}</div>
                <div class="gang-desc">{{ g.description }}</div>
                <div class="gang-stats"><span>等级 {{ g.level || 1 }}</span><span>成员 {{ g.memberCount }}人</span></div>
                <button class="forge-btn" @click="gameStore.joinGang(g.name)">加入</button>
              </div>
            </div>
            <!-- 创建帮派 -->
            <div class="gang-create-section">
              <div class="section-title">创建帮派（需5级+1000金币）</div>
              <input v-model="newGangName" placeholder="帮派名称" class="gang-input" />
              <input v-model="newGangDesc" placeholder="帮派宗旨" class="gang-input" />
              <button class="forge-btn" @click="createGangAction">创建</button>
            </div>
          </div>
        </div>

        <!-- 拍卖行 -->
        <div v-if="activeTab === 'auction'">
          <div class="auction-tabs">
            <button class="menu-tab" :class="{ active: auctionView === 'list' }" @click="auctionView = 'list'; gameStore.searchAuctions('')">市场</button>
            <button class="menu-tab" :class="{ active: auctionView === 'my' }" @click="auctionView = 'my'; gameStore.loadMyAuctions()">我的</button>
            <button class="menu-tab" :class="{ active: auctionView === 'sell' }" @click="auctionView = 'sell'">出售</button>
          </div>
          <!-- 市场列表 -->
          <div v-if="auctionView === 'list'">
            <div v-for="item in gameStore.auctions.listings" :key="item.id || item._id" class="auction-item">
              <div class="auction-name">{{ item.itemName }}</div>
              <div class="auction-detail">
                <span>💰 {{ item.price }}金 x{{ item.quantity }}</span>
                <span>卖家: {{ item.sellerName }}</span>
              </div>
              <button class="forge-btn" @click="gameStore.buyAuction(item._id || item.id)">购买</button>
            </div>
            <div v-if="!gameStore.auctions.listings.length" class="empty-hint">暂无商品</div>
          </div>
          <!-- 我的挂单 -->
          <div v-if="auctionView === 'my'">
            <div v-for="item in gameStore.auctions.myListings" :key="item.id || item._id" class="auction-item">
              <div class="auction-name">{{ item.itemName }}</div>
              <div class="auction-detail"><span>💰 {{ item.price }}金 x{{ item.quantity }}</span></div>
              <button class="btn btn-secondary" @click="gameStore.cancelAuction(item._id || item.id)">下架</button>
            </div>
            <div v-if="!gameStore.auctions.myListings.length" class="empty-hint">暂无挂单</div>
          </div>
          <!-- 出售 -->
          <div v-if="auctionView === 'sell'">
            <div class="auction-sell-form">
              <select v-model="auctionItemId" class="auction-select">
                <option value="">选择物品...</option>
                <option v-for="item in gameStore.inventory" :key="item.itemId || item._id" :value="item.itemId">{{ item.name || item.itemId }} x{{ item.quantity }}</option>
              </select>
              <input v-model.number="auctionQuantity" type="number" min="1" placeholder="数量" class="gang-input" />
              <input v-model.number="auctionPrice" type="number" min="1" placeholder="单价(金币)" class="gang-input" />
              <select v-model="auctionDuration" class="auction-select">
                <option :value="24">24小时</option>
                <option :value="48">48小时</option>
                <option :value="72">72小时</option>
              </select>
              <button class="forge-btn" @click="createAuctionAction">上架 (5%手续费)</button>
            </div>
          </div>
        </div>

        <!-- 生活技能 -->
        <div v-if="activeTab === 'life'">
          <div class="life-tabs">
            <button class="menu-tab" :class="{ active: lifeView === 'herb' }" @click="lifeView = 'herb'; gameStore.loadGatheringNodes()">🌿采药</button>
            <button class="menu-tab" :class="{ active: lifeView === 'mining' }" @click="lifeView = 'mining'; gameStore.loadGatheringNodes()">⛏️挖矿</button>
            <button class="menu-tab" :class="{ active: lifeView === 'fishing' }" @click="lifeView = 'fishing'; gameStore.loadGatheringNodes()">🎣钓鱼</button>
            <button class="menu-tab" :class="{ active: lifeView === 'alchemy' }" @click="lifeView = 'alchemy'; gameStore.loadAlchemyRecipes()">⚗️炼药</button>
            <button class="menu-tab" :class="{ active: lifeView === 'cooking' }" @click="lifeView = 'cooking'; gameStore.loadCookingRecipes()">🍳烹饪</button>
            <button class="menu-tab" :class="{ active: lifeView === 'forging' }" @click="lifeView = 'forging'; gameStore.loadForgeRecipes()">🔨锻造</button>
          </div>

          <!-- 三系采集 -->
          <div v-if="['herb','mining','fishing'].includes(lifeView)">
            <div v-for="node in filteredGatherNodes(lifeView)" :key="node.id" class="gather-node" :class="{ 'gather-locked': !node.canGather }">
              <div class="gather-name">{{ node.icon || '' }} {{ node.name }} 
                <span v-if="node.rarity === 'rare'" style="color:#4fc3f7">稀有</span>
                <span v-if="node.rarity === 'epic'" style="color:#c084fc">史诗</span>
              </div>
              <div class="gather-desc">{{ node.description }}</div>
              <div class="gather-meta">
                <span v-if="node.level">需{{ lifeView === 'herb' ? '采药' : lifeView === 'mining' ? '挖矿' : '钓鱼' }}Lv{{ node.level }}
                  <span v-if="!node.canGather" style="color:#f66">(你Lv{{ node.userLevel }})</span>
                </span>
                <span v-if="node.cooldownRemaining > 0" style="color:#f66">冷却 {{ node.cooldownRemaining }}秒</span>
              </div>
              <button class="forge-btn" :disabled="!node.available || !node.canGather || node.cooldownRemaining > 0" @click="gameStore.gather(lifeView, node.id)">
                {{ !node.canGather ? '🔒 等级不足' : node.cooldownRemaining > 0 ? '冷却中...' : '采集' }}
              </button>
            </div>
            <div v-if="!filteredGatherNodes(lifeView).length" class="empty-hint">当前房间没有{{ lifeView === 'herb' ? '采药' : lifeView === 'mining' ? '矿脉' : '钓点' }}</div>
          </div>

          <!-- 炼药 -->
          <div v-if="lifeView === 'alchemy'">
            <div v-for="r in gameStore.alchemyRecipes" :key="r.id" class="craft-recipe">
              <div class="craft-name">{{ r.name }} <span class="craft-lv">Lv{{ r.level }}</span></div>
              <div class="craft-desc">{{ r.description }}</div>
              <div class="craft-cost">
                <span v-if="r.goldCost">💰{{ r.goldCost }}金</span>
                <span v-for="m in (r.materials || [])" :key="m.itemId">{{ getItemName(m.itemId) }}×{{ m.quantity }}</span>
              </div>
              <button class="forge-btn" @click="gameStore.alchemy(r.id)">炼制 ({{ (r.successRate*100).toFixed(0) }}%)</button>
            </div>
            <div v-if="!gameStore.alchemyRecipes.length" class="empty-hint">暂无炼药配方</div>
          </div>

          <!-- 烹饪 -->
          <div v-if="lifeView === 'cooking'">
            <div v-for="r in gameStore.cookingRecipes" :key="r.id" class="craft-recipe">
              <div class="craft-name">{{ r.name }} <span class="craft-lv">Lv{{ r.level }}</span></div>
              <div class="craft-desc">{{ r.description }}</div>
              <div class="craft-cost">
                <span v-if="r.goldCost">💰{{ r.goldCost }}金</span>
                <span v-for="m in (r.materials || [])" :key="m.itemId">{{ getItemName(m.itemId) }}×{{ m.quantity }}</span>
              </div>
              <button class="forge-btn" @click="gameStore.cooking(r.id)">烹饪 ({{ (r.successRate*100).toFixed(0) }}%)</button>
            </div>
            <div v-if="!gameStore.cookingRecipes.length" class="empty-hint">暂无烹饪配方</div>
          </div>

          <!-- 锻造 -->
          <div v-if="lifeView === 'forging'">
            <div v-for="r in gameStore.forgeRecipes" :key="r.id" class="craft-recipe">
              <div class="craft-name">{{ r.name }} <span class="craft-lv">Lv{{ r.level }}</span></div>
              <div class="craft-desc">{{ r.description }}</div>
              <div class="craft-cost">
                <span v-if="r.goldCost">💰{{ r.goldCost }}金</span>
                <span v-for="m in (r.materials || [])" :key="m.itemId">{{ getItemName(m.itemId) }}×{{ m.quantity }}</span>
              </div>
              <button class="forge-btn" @click="gameStore.forge(r.id)">锻造 ({{ (r.successRate*100).toFixed(0) }}%)</button>
            </div>
            <div v-if="!gameStore.forgeRecipes.length" class="empty-hint">暂无锻造配方</div>
          </div>
        </div>

                <!-- 每日活跃 -->
        <div v-if="activeTab === 'daily'">
          <!-- ===== 简化每日活跃 v2 ===== -->
          <div class="daily-section daily-v2-card" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border: 2px solid #e94560; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
            <div class="section-title" style="color: #e94560; margin-bottom: 12px;">🎯 每日活跃（简版）</div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 0.85em; color: #aaa;">连续签到 {{ gameStore.dailyV2Status?.streak || 0 }} 天</span>
            </div>
            <!-- 四项活跃任务 -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 14px;">
              <div :class="['v2-task-chip', gameStore.dailyV2Status?.tasks?.checkedIn ? 'v2-done' : '']">
                <span class="v2-task-icon">{{ gameStore.dailyV2Status?.tasks?.checkedIn ? '✅' : '⬜' }}</span>
                <span>📅 签到</span>
                <button v-if="!gameStore.dailyV2Status?.tasks?.checkedIn"
                  class="v2-do-btn" @click="gameStore.dailyCheckin(); gameStore.loadDailyV2Status()">去签到</button>
                <span v-else class="v2-done-label">已完成</span>
              </div>
              <div :class="['v2-task-chip', gameStore.dailyV2Status?.tasks?.fished ? 'v2-done' : '']">
                <span class="v2-task-icon">{{ gameStore.dailyV2Status?.tasks?.fished ? '✅' : '⬜' }}</span>
                <span>🎣 钓鱼1次</span>
                <span v-if="gameStore.dailyV2Status?.tasks?.fished" class="v2-done-label">已完成</span>
                <span v-else style="font-size:0.7em;color:#888">去池塘边钓</span>
              </div>
              <div :class="['v2-task-chip', gameStore.dailyV2Status?.tasks?.herbed ? 'v2-done' : '']">
                <span class="v2-task-icon">{{ gameStore.dailyV2Status?.tasks?.herbed ? '✅' : '⬜' }}</span>
                <span>🌿 采药1次</span>
                <span v-if="gameStore.dailyV2Status?.tasks?.herbed" class="v2-done-label">已完成</span>
                <span v-else style="font-size:0.7em;color:#888">去野外采</span>
              </div>
              <div :class="['v2-task-chip', gameStore.dailyV2Status?.tasks?.crafted ? 'v2-done' : '']">
                <span class="v2-task-icon">{{ gameStore.dailyV2Status?.tasks?.crafted ? '✅' : '⬜' }}</span>
                <span>🔨 打造1次</span>
                <span v-if="gameStore.dailyV2Status?.tasks?.crafted" class="v2-done-label">已完成</span>
                <span v-else style="font-size:0.7em;color:#888">锻造/炼药/烹饪</span>
              </div>
            </div>
            <!-- 领取按钮 -->
            <div style="text-align: center;">
              <button v-if="!gameStore.dailyV2Status?.rewardClaimed && gameStore.dailyV2Status?.allDone"
                class="forge-btn" style="background: linear-gradient(135deg, #e94560, #c23152); color: #fff; padding: 10px 30px; font-size: 1em; animation: pulse-glow 2s infinite;"
                @click="gameStore.claimDailyV2Reward()">
                🎁 领取活跃宝箱
              </button>
              <button v-else-if="gameStore.dailyV2Status?.rewardClaimed"
                class="forge-btn" style="background: #444; color: #888;" disabled>
                ✅ 今日宝箱已领取
              </button>
              <button v-else
                class="forge-btn" style="background: #444; color: #888;" disabled>
                🔒 完成4项活跃任务后领取
              </button>
            </div>
          </div>

          <!-- ===== 旧版签到/任务/活跃 ===== -->
          <div class="daily-section">
            <div class="section-title">📅 每日签到（详情）</div>
            <div class="daily-checkin-info" v-if="gameStore.dailyStatus">
              <span>连续签到 {{ gameStore.dailyStatus.checkinStreak || 0 }} 天</span>
              <span v-if="gameStore.dailyStatus.checkedInToday">✅ 今日已签到</span>
            </div>
            <button class="forge-btn" :disabled="gameStore.dailyStatus?.checkedInToday" @click="gameStore.dailyCheckin()">
              {{ gameStore.dailyStatus?.checkedInToday ? '✅ 已签到' : '签到' }}
            </button>
          </div>
          <!-- 每日任务 -->
          <div class="daily-section" v-if="gameStore.dailyStatus?.dailyTasks">
            <div class="section-title">📋 每日任务</div>
            <div v-for="task in gameStore.dailyStatus.dailyTasks" :key="task.taskId || task.id" class="daily-task">
              <div class="task-name">{{ task.name || task.taskId }}</div>
              <div class="task-progress">{{ task.progress || 0 }}/{{ task.target || 1 }}</div>
              <button v-if="task.progress >= task.target && !task.claimed" class="forge-btn small" @click="gameStore.claimDailyTask(task.taskId || task.id)">领取</button>
              <span v-if="task.claimed" class="task-done">✅</span>
            </div>
          </div>
          <!-- 活跃度奖励 -->
          <div class="daily-section" v-if="gameStore.dailyStatus?.activityPoints !== undefined">
            <div class="section-title">⭐ 活跃度 {{ gameStore.dailyStatus.activityPoints }}/100</div>
            <div class="activity-rewards">
              <button v-if="gameStore.dailyStatus.activityPoints >= 30 && !gameStore.dailyStatus.reward30Claimed" class="forge-btn" @click="gameStore.claimActivityReward(30)">领取30活跃奖励</button>
              <span v-else-if="gameStore.dailyStatus.reward30Claimed" class="task-done">✅ 30奖励已领</span>
              <button v-if="gameStore.dailyStatus.activityPoints >= 60 && !gameStore.dailyStatus.reward60Claimed" class="forge-btn" @click="gameStore.claimActivityReward(60)">领取60活跃奖励</button>
              <span v-else-if="gameStore.dailyStatus.reward60Claimed" class="task-done">✅ 60奖励已领</span>
              <button v-if="gameStore.dailyStatus.activityPoints >= 100 && !gameStore.dailyStatus.reward100Claimed" class="forge-btn" @click="gameStore.claimActivityReward(100)">领取100活跃奖励</button>
              <span v-else-if="gameStore.dailyStatus.reward100Claimed" class="task-done">✅ 100奖励已领</span>
            </div>
          </div>
        </div>

        <!-- 商店 -->
        <div v-if="activeTab === 'shop'">
          <button class="item-btn" @click="loadShopItems" style="margin-bottom:8px">刷新商品</button>
          <div v-for="item in shopItems" :key="item.id" class="inventory-item">
            <div class="item-header">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-price">💰{{ item.price }}</span>
            </div>
            <div class="item-desc">{{ item.description }}</div>
            <div class="item-stats" v-if="item.stats">
              <span v-for="(val, key) in item.stats" :key="key">{{ statLabel(key) }}+{{ val }} </span>
            </div>
            <button class="forge-btn" @click="buyItem(item.id)">购买</button>
          </div>
          <div v-if="!shopItems.length" class="empty-hint">当前房间没有商店</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

// ===== 本地化翻译映射 =====
const roomNames = {"village_center": "村庄广场", "village_inn": "客栈", "village_blacksmith": "铁匠铺", "village_shop": "杂货铺", "village_training": "练武场", "forest_entrance": "森林入口", "forest_deep": "森林深处", "forest_clearing": "林间空地", "forest_cave": "神秘洞穴", "city_gate": "城门", "city_square": "城市广场", "city_tavern": "醉仙楼", "city_market": "集市", "city_arena": "竞技场", "city_guild": "侠客公会", "mountain_path": "山道", "mountain_peak": "山顶", "mountain_temple": "青云观", "desert_entrance": "荒漠入口", "desert_oasis": "绿洲", "desert_ruins": "古城遗址", "desert_tomb": "地下陵墓", "snow_pass": "雪山关隘", "snow_village": "雪村", "snow_cave": "冰洞", "snow_palace": "冰宫", "swamp_entrance": "沼泽边缘", "swamp_deep": "沼泽深处", "swamp_island": "沼泽孤岛", "swamp_lair": "毒蛟巢穴", "island_beach": "仙岛海滩", "island_forest": "仙岛密林", "island_peak": "仙岛山顶", "island_cave": "仙人洞府", "underground_entrance": "迷宫入口", "underground_hall": "中央大厅", "underground_prison": "囚牢区", "underground_treasure": "宝藏室", "volcano_base": "火山脚下", "volcano_crater": "火山口", "volcano_lair": "火蛟巢穴", "volcano_forge": "熔火锻造", "palace_gate": "宫门", "palace_courtyard": "御花园", "palace_hall": "金銮殿", "palace_garden": "后花园", "palace_library": "皇家藏书阁", "demon_portal": "魔域入口", "demon_fortress": "魔族堡垒", "demon_arena": "魔族竞技场", "demon_throne": "魔王殿", "forest_path": "林间小径", "deep_forest": "密林深处", "village_field": "村外田野", "river_bank": "河边", "dark_cave": "黑暗洞窟", "snow_field": "雪原", "bamboo_grove": "竹林", "shaolin_temple": "少林寺", "shaolin_pagoda": "少林塔林", "wudang_peak": "武当山", "wudang_hall": "武当真武殿", "emei_temple": "峨眉金顶", "emei_hall": "峨眉万法堂", "mingjiao_hall": "明教光明顶", "mingjiao_sanctum": "明教密殿", "xiaoyao_valley": "逍遥谷", "xiaoyao_pavilion": "逍遥阁", "gaibang_hq": "丐帮总舵", "gaibang_hall": "丐帮议事厅", "forest_waterfall": "林中瀑布", "herbalist_hut": "药师草庐", "city_docks": "洛阳码头", "city_residential": "民居区", "city_temple": "城隍庙", "city_bridge": "石桥", "mountain_cliff": "山崖", "mountain_spring": "山泉", "mountain_bridge": "铁索桥", "sky_path": "天路", "heaven_gate": "天之门", "celestial_palace": "天宫", "desert_bazaar": "沙漠集市", "desert_pyramid": "金字塔", "pyramid_interior": "金字塔内", "pyramid_tomb": "法老之墓", "graveyard_entrance": "乱葬岗", "graveyard_deep": "墓地深处", "crypt": "地下墓穴", "lakeside": "湖畔", "lake_village": "渔村", "lake_island": "湖心岛", "underwater_cave": "水下洞穴", "cave_network": "地下洞穴", "bandit_camp": "山贼营地", "bandit_stronghold": "山贼山寨", "canyon_entrance": "峡谷入口", "canyon_deep": "峡谷深处", "canyon_cross": "峡谷岔路", "canyon_abyss": "深渊谷底", "crystal_cave": "水晶洞", "city_rich": "富人区", "auction_house": "拍卖行", "city_slums": "贫民窟", "gambling_den": "地下赌坊", "tea_house": "清风茶楼", "ancient_tree": "万年古树", "tree_canopy": "树冠之上", "cloud_sea": "云海", "hot_springs": "山间温泉", "coastal_cliff": "海崖", "pirate_cove": "海盗湾", "pirate_ship": "幽灵海盗船", "captain_cabin": "船长室", "ancient_battlefield": "古战场", "secret_garden": "秘境花园", "snow_peak": "雪山顶", "snow_monastery": "雪寺", "swamp_village": "沼泽村落", "swamp_altar": "沼泽祭坛", "demon_prison": "魔族监狱", "demon_treasury": "魔族宝库", "plains": "草原", "plains_camp": "游牧营地", "plains_lake": "草原湖泊", "plains_ruins": "草原遗迹", "mushroom_forest": "蘑菇林", "wind_valley": "风之谷", "bamboo_temple": "竹林禅院", "bamboo_hall": "禅院武堂", "dragon_graveyard": "龙墓", "jiao_shrine": "龙神殿", "rainbow_bridge": "彩虹桥", "fire_shrine": "炎之殿", "water_shrine": "水之殿", "mirror_lake": "镜湖", "phoenix_peak": "凤凰台", "phoenix_nest": "凤凰巢", "time_tower": "时光塔", "time_tower_top": "时光之巅", "shadow_realm": "暗影界", "shadow_throne": "暗影王座", "xuankong_temple": "悬空寺", "xuankong_hall": "悬空大殿", "underground_river": "地下暗河", "abyss_waterfall": "深渊瀑布", "thunder_peak": "雷霆峰", "thunder_shrine": "雷神殿", "mist_valley": "迷雾谷", "jade_palace": "玉虚宫", "starlit_bridge": "星光桥", "void_edge": "虚空边缘", "jiao_palace": "海底水府", "coral_garden": "珊瑚园", "dragon_throne_room": "龙王殿", "sky_bazaar": "云中集市", "underground_city": "地下城", "underground_market": "地下集市", "opera_house": "梨园", "observatory": "观星台", "cherry_garden": "樱园", "lava_tubes": "熔岩通道", "volcano_core": "地核之心", "warrior_tombs": "侠客陵", "city_center": "洛阳城中心", "city_north": "洛阳北街", "city_south": "洛阳南街", "city_east": "洛阳东街", "city_west": "洛阳西街", "shaolin_gate": "少林寺山门", "wudang_gate": "武当山山门", "emei_gate": "峨眉派山门", "gaibang_gate": "丐帮总舵入口", "mingjiao_gate": "明教光明顶入口", "xiaoyao_gate": "逍遥派入口"}
const dirNames = {"north": "北", "south": "南", "east": "东", "west": "西", "northwest": "西北", "northeast": "东北", "southwest": "西南", "southeast": "东南", "up": "上", "down": "下", "enter": "进入", "out": "离开"}
function roomDisplayName(roomId) {
  return roomNames[roomId] || roomId
}
function dirDisplayName(dir) {
  return dirNames[dir] || dir
}
function getRoomDisplayName(room) {
  if (typeof room === 'string') return roomDisplayName(room)
  if (room?.name) return room.name
  return room?.id ? roomDisplayName(room.id) : '未知'
}
const statLabels = { strength: '力量', dexterity: '敏捷', constitution: '体质', intelligence: '悟性', charisma: '根骨' }
const RANK_LABELS = { disciple: '弟子', deacon: '执事', elder: '长老', leader: '掌门' }
function rankLabel(rank) { return RANK_LABELS[rank] || rank }
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import axios from 'axios'

const router = useRouter()
const gameStore = useGameStore()

const command = ref('')
const activeTab = ref('inventory')
const messageArea = ref(null)
const chatChannel = ref('world')
const chatTarget = ref('')
const showChatMode = ref(false)
const tradeGoldInput = ref(0)
const tradeItemSelect = ref('')
const shopItems = ref([])

// Phase 7-8 UI state
const gangSearchQuery = ref('')
const newGangName = ref('')
const newGangDesc = ref('')
const gangDonateGold = ref(0)
const auctionView = ref('list')
const auctionItemId = ref('')
const auctionQuantity = ref(1)
const auctionPrice = ref(100)
const auctionDuration = ref(48)
const lifeView = ref('herb')

// 计算属性
const isDead = computed(() => gameStore.isDead || (gameStore.user?.hp?.current <= 0 && !gameStore.battle))
const freePoints = computed(() => gameStore.user?.freePoints || gameStore.user?.attributePoints || 0)
const showMap = ref(false)

const factionRankLabel = computed(() => {
  const rank = gameStore.user?.factionRank
  const labels = { disciple: '弟子', deacon: '执事', elder: '长老', leader: '掌门' }
  return labels[rank] || rank || '弟子'
})

const canAdvanceFaction = computed(() => {
  const rep = gameStore.user?.factionReputation || 0
  const lvl = gameStore.user?.level || 0
  const rank = gameStore.user?.factionRank
  if (rank === 'leader') return false
  if (rank === 'elder') return rep >= 2000 && lvl >= 50
  if (rank === 'deacon') return rep >= 500 && lvl >= 25
  return rep >= 100 && lvl >= 10 // disciple needs 100 rep + lvl 10 to advance
})

const commandPlaceholder = computed(() => {
  if (showChatMode.value) {
    if (chatChannel.value === 'private') {
      return chatTarget.value ? `私聊 ${chatTarget.value}: ` : '输入玩家名或 /w 玩家名 内容'
    }
    return chatChannel.value === 'room' ? '区域聊天: ' : '世界聊天: '
  }
  return '输入命令 (help 查看帮助)'
})

const myTradeOffer = computed(() => {
  const trade = gameStore.activeTrade
  if (!trade) return { items: [], gold: 0 }
  if (trade.initiator?.name === gameStore.user?.characterName) {
    return trade.initiator.offer || { items: [], gold: 0 }
  }
  return trade.receiver?.offer || { items: [], gold: 0 }
})

const partnerTradeOffer = computed(() => {
  const trade = gameStore.activeTrade
  if (!trade) return { items: [], gold: 0 }
  if (trade.initiator?.name === gameStore.user?.characterName) {
    return trade.receiver?.offer || { items: [], gold: 0 }
  }
  return trade.initiator?.offer || { items: [], gold: 0 }
})

const myTradeConfirmed = computed(() => {
  const trade = gameStore.activeTrade
  if (!trade) return false
  if (trade.initiator?.name === gameStore.user?.characterName) {
    return trade.initiator?.confirmed
  }
  return trade.receiver?.confirmed
})

const tradeableItems = computed(() => {
  return (gameStore.inventory || []).filter(i => !i.isEquipped)
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

const hasFactionNpc = computed(() => {
  return (gameStore.currentRoom?.npcs || []).some(n => n.type === 'faction')
})

const equipmentSlots = computed(() => {
  const slots = [
    { key: 'weapon', label: '🗡️ 武器' },
    { key: 'armor', label: '🛡️ 铠甲' },
    { key: 'helmet', label: '⛑️ 头盔' },
    { key: 'boots', label: '👢 靴子' },
    { key: 'ring', label: '💍 戒指' },
    { key: 'accessory', label: '📿 饰品' }
  ]
  const equipped = (gameStore.inventory || []).filter(i => i.isEquipped)
  return slots.map(s => ({
    ...s,
    item: equipped.find(i => i.equipSlot === s.key) || null
  }))
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
    actions.push({ label: '💪 训练', command: 'train ' })
  }

  if (services.some(service => ['learn_skill', 'meditate'].includes(service))) {
    actions.push({ label: '📖 学技能', command: 'skills learn' })
  }

  if (services.some(service => ['shop', 'buy_item', 'buy_weapon', 'buy_armor', 'sell_item'].includes(service))) {
    actions.push({ label: '🛒 购买', command: 'buy ' })
    actions.push({ label: '💰 出售', command: 'sell ' })
  }

  if (services.includes('quest')) {
    actions.push({ label: '📜 接任务', command: 'quests' })
  }

  if (services.includes('rumor')) {
    actions.push({ label: '💬 打听消息', command: 'rumor' })
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
    'out': '外',
    'back': '返'
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
  const cmd = command.value.trim()
  
  // 聊天模式
  if (showChatMode.value) {
    if (chatChannel.value === 'world') {
      gameStore.socket?.emit('chat_world', { content: cmd })
    } else if (chatChannel.value === 'room') {
      gameStore.socket?.emit('chat_room', { content: cmd })
    } else if (chatChannel.value === 'private') {
      if (chatTarget.value) {
        gameStore.socket?.emit('chat_private', { targetName: chatTarget.value, content: cmd })
      } else {
        // 尝试解析 /w 玩家名 内容 格式
        const match = cmd.match(/^\/w\s+(\S+)\s+(.+)$/)
        if (match) {
          gameStore.socket?.emit('chat_private', { targetName: match[1], content: match[2] })
        } else {
          gameStore.addMessage('error', '请先输入目标玩家名，或使用 /w 玩家名 内容')
        }
      }
    }
    command.value = ''
    return
  }
  
  // 命令模式
  gameStore.sendCommand(cmd)
  command.value = ''
}

function hasNpcQuest(npc) {
  // Check if any active quest targets this NPC or if NPC has quests
  const quests = gameStore.npcDialog?.npc?.quests
  if (quests?.length) {
    // Check if any are completable, available, or accepted
    const allQuests = [
      ...(gameStore.npcDialog?.completableQuests || []),
      ...(gameStore.npcDialog?.availableQuests || []),
      ...(gameStore.npcDialog?.acceptedQuests || [])
    ]
    return quests.some(qId => allQuests.some(q => q.id === qId))
  }
  return npc.quests?.length > 0
}
function isNpcQuestDone(npc) {
  if (!npc.quests?.length) return false
  return npc.quests.every(qId => 
    gameStore.npcDialog?.completableQuests?.some(q => q.id === qId)
  )
}
function getDirectionEmoji(dir) {
  const map = { north: '⬆️', south: '⬇️', east: '➡️', west: '⬅️',
    northwest: '↖️', northeast: '↗️', southwest: '↙️', southeast: '↘️',
    up: '⬆️', down: '⬇️', enter: '🚪', out: '🚪' }
  return map[dir] || '🔹'
}

function quickCommand(cmd) {
  // 以空格结尾的命令需要参数，预填到输入框让用户补全
  if (cmd.endsWith(' ')) {
    command.value = cmd
    showChatMode.value = false
    return
  }
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
  const quest = gameStore.gameConfig?.quests?.[questId] || gameStore.gameConfig?.factionQuests?.[questId]
  return quest?.name || questId
}

function getQuestConfig(questId) {
  return gameStore.gameConfig?.quests?.[questId] || gameStore.gameConfig?.factionQuests?.[questId] || null
}

function needNpcHandIn(questId) {
  const config = getQuestConfig(questId)
  return config?.completionMode === 'npc' && config?.handInNpcId
}

function getHandInNpcName(questId) {
  const config = getQuestConfig(questId)
  const npcId = config?.handInNpcId
  if (!npcId) return 'NPC'
  const npc = gameStore.gameConfig?.npcs?.[npcId]
  return npc?.name || npcId
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

// NPC服务按钮处理
function useNPCServices(svc) {
  gameStore.npcDialog = null
  if (['shop', 'buy_item', 'buy_weapon', 'buy_armor'].includes(svc)) {
    activeTab.value = 'shop'
    loadShopItems()
  } else if (svc === 'repair') {
    gameStore.sendCommand('repair')
  } else if (svc === 'sell_item') {
    activeTab.value = 'shop'
    loadShopItems()
  } else if (svc === 'forge_weapon') {
    activeTab.value = 'life'
  } else if (svc === 'teleport') {
    // 传送目的地直接显示在下方
    return
  }
}

function acceptQuest(questId) {
  gameStore.socket?.emit('accept_quest', { questId })
  gameStore.npcDialog = null
}

function completeQuest(questId) {
  gameStore.socket?.emit('complete_quest', { questId })
  gameStore.npcDialog = null
}
function doTeleport(npcId, destinationId) {
  gameStore.socket?.emit('teleport', { npcId, destinationId })
  gameStore.npcDialog = null
}


function exchangeSkill(skillId) {
  gameStore.socket?.emit('faction_exchange', { skillId })
}

function claimQuestReward(questId) {
  gameStore.socket?.emit('complete_quest', { questId })
}

function equipItem(item) {
  if (item) {
    gameStore.sendCommand(`use ${item._id}`)
  }
}

function unequipItem(item) {
  if (item && gameStore.socket) {
    gameStore.socket.emit('unequip_item', { inventoryId: item._id })
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
  return item?.type === 'weapon' || item?.type === 'armor' || item?.type === 'equipment'
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
  const next = Math.floor(100 * Math.pow(level, 1.5))
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
  if (turn.action === 'skill' && turn.skill) parts.push(`使用【${turn.skill}】`)
  else if (turn.action === 'attack') parts.push('攻击')
  else if (turn.action === 'defend') parts.push('进入防御姿态')
  else if (turn.action === 'flee') parts.push('试图逃跑')
  else if (turn.action) parts.push(turn.action)
  if (turn.damage) parts.push(`造成${turn.damage}点伤害`)
  if (turn.healed) parts.push(`恢复${turn.healed}点生命`)
  if (turn.mpCost) parts.push(`消耗${turn.mpCost}MP`)
  if (turn.hpCost) parts.push(`消耗${turn.hpCost}HP`)
  if (turn.reflectedDamage) parts.push(`(反弹${turn.reflectedDamage}伤害)`)
  if (turn.counterDamage) parts.push(`(反击${turn.counterDamage}伤害)`)
  if (turn.dodged) parts.push('✗被闪避')
  if (turn.fled) parts.push('逃跑成功')
  if (turn.defending) parts.push('(防御)')
  if (turn.skipped) parts.push('(无法行动)')
  if (turn.mutualDefeat) parts.push('同归于尽!')
  if (turn.remainingHp !== undefined && !turn.damage) parts.push(`(剩余HP:${turn.remainingHp})`)
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

function loadOnlinePlayers() {
  gameStore.loadOnlinePlayers()
}

function getFactionName(factionId) {
  const faction = gameStore.gameConfig?.factions?.[factionId]
  return faction?.name || factionId || ''
}

function addTradeItem() {
  if (!tradeItemSelect.value || !gameStore.activeTrade) return
  gameStore.tradeAddItem(gameStore.activeTrade.tradeId, tradeItemSelect.value)
  tradeItemSelect.value = ''
}

function tradeSetGold(tradeId, gold) {
  gameStore.tradeSetGold(tradeId, gold)
}

function tradeConfirm(tradeId) {
  gameStore.tradeConfirm(tradeId)
}

function tradeCancel(tradeId) {
  gameStore.tradeCancel(tradeId)
}

function tradeRemoveItem(tradeId, itemId) {
  gameStore.tradeRemoveItem(tradeId, itemId)
}

function requestTrade(playerName) {
  gameStore.requestTrade(playerName)
}

function pvpChallenge(playerName) {
  gameStore.sendPvpChallenge(playerName)
}

function pvpAccept(challengerName) {
  gameStore.pvpAccept(challengerName)
}

function pvpDecline(challengerName) {
  gameStore.pvpDecline(challengerName)
}

function isAchieved(achId) {
  return gameStore.achievements.achieved?.some(a => a.achievementId === achId)
}

function loadAchievements() {
  gameStore.loadAchievements()
}

function loadForgeRecipes() {
  gameStore.loadForgeRecipes()
}

function forge(recipeId) {
  gameStore.forge(recipeId)
}

// P6: 副本类型标签
function typeLabel(type) {
  const map = { trial: '试炼', explore: '探索', boss: 'BOSS', tower: '爬塔', stealth: '潜行', drift: '漂流' }
  return map[type] || type
}

// P6: 根据副本类型调用不同进入方法
function enterDungeonByType(d) {
  switch (d.type) {
    case 'tower':
      gameStore.enterDungeon(d.id)
      setTimeout(() => gameStore.towerFloorInfo(d.id), 500)
      break
    case 'stealth':
      gameStore.stealthStart(d.id)
      break
    case 'drift':
      gameStore.driftStart(d.id, 'normal')
      break
    default:
      gameStore.enterDungeon(d.id)
  }
}

// P7: 按采集类型过滤节点
function filteredGatherNodes(skillType) {
  return (gameStore.gatheringNodes || []).filter(n => n.skillType === skillType)
}

// Phase 7-8 helper functions
function gangDoDonate() {
  gameStore.gangDonate(gangDonateGold.value || 0)
  gangDonateGold.value = 0
}
function createGangAction() {
  if (newGangName.value.trim()) {
    gameStore.createGang(newGangName.value.trim(), newGangDesc.value.trim())
    newGangName.value = ''
    newGangDesc.value = ''
  }
}
function createAuctionAction() {
  if (auctionItemId.value && auctionQuantity.value > 0 && auctionPrice.value > 0) {
    gameStore.createAuction(auctionItemId.value, auctionQuantity.value, auctionPrice.value, auctionDuration.value)
    auctionItemId.value = ''
    auctionQuantity.value = 1
    auctionPrice.value = 100
  }
}

function loadShopItems() {
  gameStore.socket?.emit('shop_list')
}

function buyItem(itemId) {
  gameStore.socket?.emit('buy_item', { itemId, quantity: 1 })
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
  // 加载时间信息
  gameStore.getTimeInfo()

  // 监听商店物品更新
  gameStore.socket?.on('shop_items', (data) => {
    shopItems.value = data.items || []
  })
})

onUnmounted(() => {
  gameStore.socket?.off('shop_items')
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

/* NPC任务对话框 */
.quest-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
}
.quest-dialog {
  background: #1a1a2e;
  border: 2px solid #4a9eff;
  border-radius: 12px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  max-height: 70vh;
  overflow-y: auto;
}
.quest-dialog-title {
  font-size: 20px;
  color: #ffd700;
  font-weight: bold;
  margin-bottom: 8px;
}
.quest-dialog-message {
  color: #ccc;
  font-size: 14px;
  margin-bottom: 15px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
}
.quest-offer-list { margin-bottom: 12px; }
.quest-offer-title {
  color: #4a9eff;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
}
.quest-offer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  margin-bottom: 6px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  border: 1px solid #333;
}
.quest-offer-info { flex: 1; }
.quest-offer-name { color: #eee; font-size: 14px; font-weight: bold; }
.quest-main { color: #ffd700; }
.quest-side { color: #4a9eff; }
.quest-daily { color: #4caf50; }
.quest-offer-desc { color: #999; font-size: 12px; margin-top: 2px; }
.quest-offer-rewards { color: #8b8; font-size: 11px; margin-top: 3px; }
.quest-offer-locked { color: #f66; font-size: 11px; margin-top: 3px; }
.quest-accept-btn {
  padding: 6px 16px;
  background: #4a9eff;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}
.quest-accept-btn:hover { background: #66b3ff; }
.quest-offer-empty { color: #777; font-size: 13px; margin-bottom: 12px; }
.quest-offer-title.completable { color: #4caf50; }
.quest-offer-title.accepted { color: #ff9800; }
.quest-offer-item.completable { border-color: #4caf50; background: rgba(76,175,80,0.08); }
.quest-offer-item.accepted { border-color: #ff9800; background: rgba(255,152,0,0.05); }
.complete-btn { background: #4caf50 !important; }
.complete-btn:hover { background: #388e3c !important; }

/* 装备槽位 */
.equipment-slots {
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  border: 1px solid #2a2a4a;
}
.equip-slots-title {
  color: #e94560;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
}
.equip-slot-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
  gap: 8px;
  font-size: 13px;
}
.equip-slot-label {
  color: #888;
  width: 70px;
  flex-shrink: 0;
}
.equip-slot-item {
  color: #eee;
  flex: 1;
}
.equip-slot-item.empty {
  color: #555;
  font-style: italic;
}
.equip-slot-stats {
  color: #8b8;
  font-size: 11px;
}
.quest-close-btn {
  width: 100%;
  padding: 8px;
  background: #555;
  border: none;
  border-radius: 6px;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
}
.quest-close-btn:hover { background: #777; }

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

/* 在线玩家 */
.online-count {
  color: #4ade80;
  font-size: 13px;
  margin-bottom: 8px;
}
.online-player-item {
  background: #16213e;
  padding: 8px;
  border-radius: 5px;
  margin-bottom: 6px;
}
.online-player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.online-player-name { color: #eee; font-size: 13px; }
.online-player-level { color: #fbbf24; font-size: 12px; }
.online-player-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #888;
  margin-top: 3px;
}
.online-player-faction {
  color: #4fc3f7;
}

/* 聊天频道选择 */
.chat-channel-select {
  padding: 6px 8px;
  background: #16213e;
  border: 1px solid #333;
  border-radius: 5px;
  color: #eee;
  font-size: 13px;
  cursor: pointer;
}
.chat-channel-select option {
  background: #16213e;
}

/* 交易面板 */
.trade-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}
.trade-panel {
  background: #1a1a2e;
  border: 2px solid #4fc3f7;
  border-radius: 10px;
  padding: 20px;
  width: 500px;
  max-width: 90vw;
}
.trade-title {
  color: #4fc3f7;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 15px;
}
.trade-body {
  display: flex;
  gap: 15px;
}
.trade-side {
  flex: 1;
  background: #16213e;
  border-radius: 8px;
  padding: 10px;
}
.trade-side-title {
  color: #fbbf24;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
  text-align: center;
}
.trade-offer-item {
  color: #eee;
  font-size: 12px;
  padding: 3px 6px;
  background: #0f3460;
  border-radius: 3px;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.trade-remove-btn {
  background: #f87171;
  border: none;
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
}
.trade-offer-gold {
  color: #fbbf24;
  font-size: 13px;
  margin-top: 4px;
}
.trade-gold-input {
  display: flex;
  gap: 5px;
  margin-top: 8px;
}
.trade-gold-field {
  width: 80px;
  padding: 4px 8px;
  background: #0f3460;
  border: 1px solid #333;
  border-radius: 3px;
  color: #fbbf24;
  font-size: 13px;
}
.trade-btn {
  padding: 4px 10px;
  background: #4fc3f7;
  border: none;
  border-radius: 3px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}
.trade-btn:hover { background: #81d4fa; }
.trade-btn:disabled { background: #555; cursor: not-allowed; }
.trade-add-section {
  display: flex;
  gap: 5px;
  margin-top: 8px;
}
.trade-item-select {
  flex: 1;
  padding: 4px 8px;
  background: #0f3460;
  border: 1px solid #333;
  border-radius: 3px;
  color: #eee;
  font-size: 12px;
}
.trade-item-select option { background: #0f3460; }
.trade-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 15px;
}
.trade-confirm-btn {
  padding: 8px 20px;
  background: #4caf50;
  border: none;
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}
.trade-confirm-btn:hover { background: #66bb6a; }
.trade-confirm-btn:disabled { background: #555; cursor: not-allowed; }
.trade-cancel-btn {
  padding: 8px 20px;
  background: #f87171;
  border: none;
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}
.trade-cancel-btn:hover { background: #fca5a5; }
.trade-request-btn {
  padding: 2px 8px;
  background: #4fc3f7;
  border: none;
  border-radius: 3px;
  color: #fff;
  cursor: pointer;
  font-size: 11px;
}
.trade-request-btn:hover { background: #81d4fa; }

/* PVP挑战 */
.pvp-challenge-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}
.pvp-challenge-panel {
  background: #1a1a2e;
  border: 2px solid #f87171;
  border-radius: 10px;
  padding: 25px;
  text-align: center;
}
.pvp-challenge-title {
  color: #f87171;
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 15px;
}
.pvp-challenge-info {
  color: #eee;
  font-size: 15px;
  margin-bottom: 20px;
}
.pvp-challenge-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}
.pvp-accept-btn {
  padding: 10px 25px;
  background: #f87171;
  border: none;
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
}
.pvp-accept-btn:hover { background: #fca5a5; }
.pvp-decline-btn {
  padding: 10px 25px;
  background: #555;
  border: none;
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
}
.pvp-decline-btn:hover { background: #777; }
.pvp-btn {
  padding: 2px 8px;
  background: #f87171;
  border: none;
  border-radius: 3px;
  color: #fff;
  cursor: pointer;
  font-size: 11px;
}
.pvp-btn:hover { background: #fca5a5; }

/* 成就 */
.achievement-item {
  background: #16213e;
  padding: 8px;
  border-radius: 5px;
  margin-bottom: 6px;
  opacity: 0.6;
}
.achievement-item.achieved {
  opacity: 1;
  border: 1px solid #ffd700;
}
.ach-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ach-icon { font-size: 16px; }
.ach-name { color: #eee; font-size: 13px; font-weight: bold; }
.ach-desc { color: #aaa; font-size: 12px; margin-top: 3px; }
.ach-rewards {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #fbbf24;
  margin-top: 3px;
}
.ach-title { color: #c084fc; }

/* 锻造 */
.forge-recipe-item {
  background: #16213e;
  padding: 8px;
  border-radius: 5px;
  margin-bottom: 6px;
}
.forge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.forge-name { color: #eee; font-size: 13px; font-weight: bold; }
.forge-rate { color: #4ade80; font-size: 12px; }
.forge-desc { color: #aaa; font-size: 12px; margin-top: 3px; }
.forge-cost {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #fbbf24;
  margin-top: 3px;
}
.forge-btn {
  padding: 4px 12px;
  background: #f97316;
  border: none;
  border-radius: 3px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  margin-top: 6px;
}
.forge-btn:hover { background: #fb923c; }

/* 天气/时间 */
.time-weather {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: #aaa;
  margin: 4px 0;
}
.time-display { color: #4fc3f7; }
.weather-display { color: #fbbf24; }

/* ===== 简化每日活跃 v2 ===== */
.v2-task-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  transition: all 0.3s;
  font-size: 0.85em;
}
.v2-task-chip.v2-done {
  background: rgba(76,175,80,0.15);
  border-color: rgba(76,175,80,0.3);
}
.v2-task-icon {
  font-size: 0.9em;
}
.v2-do-btn {
  margin-left: auto;
  padding: 2px 8px;
  background: #e94560;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.75em;
  cursor: pointer;
}
.v2-do-btn:hover {
  background: #ff6b81;
}
.v2-done-label {
  margin-left: auto;
  font-size: 0.75em;
  color: #4caf50;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(233,69,96,0.4); }
  50% { box-shadow: 0 0 20px rgba(233,69,96,0.8); }
}


/* NPC 服务按钮 */
.npc-services-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #333;
}
.npc-service-btn {
  padding: 5px 12px;
  background: rgba(74, 158, 255, 0.15);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: #4a9eff;
  border-radius: 6px;
  font-size: 0.82em;
  cursor: pointer;
  transition: all 0.2s;
}
.npc-service-btn:hover {
  background: rgba(74, 158, 255, 0.3);
  border-color: rgba(74, 158, 255, 0.6);
}


/* 地图弹窗方向按钮 */
.map-dir-btn {
  padding: 8px 10px;
  font-size: 0.85em;
  text-align: left;
  line-height: 1.3;
  width: 100%;
}
/* NPC 任务指示图标 */
.npc-quest-icon {
  font-size: 0.7em;
  margin-left: 4px;
  opacity: 0.8;
}
.npc-quest-icon.quest-completed {
  opacity: 0.4;
}

</style>
