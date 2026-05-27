<template>
  <div class="admin-container">
    <div class="admin-sidebar">
      <h3 style="color: #e94560; margin-bottom: 20px;">GM 后台</h3>
      <div class="admin-menu-item" :class="{ active: activeMenu === 'dashboard' }" @click="activeMenu = 'dashboard'; loadDashboard()">📊 控制台</div>
      <div class="admin-menu-item" :class="{ active: activeMenu === 'players' }" @click="activeMenu = 'players'">👤 玩家管理</div>
      <div class="admin-menu-item" :class="{ active: activeMenu === 'actionLogs' }" @click="activeMenu = 'actionLogs'; loadActionLogs()">📋 行为日志</div>
      <div class="admin-menu-item" :class="{ active: activeMenu === 'questConfig' }" @click="activeMenu = 'questConfig'; loadQuestConfigs()">📜 任务配置</div>
      <div class="admin-menu-item" :class="{ active: activeMenu === 'itemConfig' }" @click="activeMenu = 'itemConfig'; loadItemConfigs()">🎒 道具配置</div>
      <div class="admin-menu-item" :class="{ active: activeMenu === 'maps' }" @click="activeMenu = 'maps'; loadMaps()">🗺️ 地图管理</div>
      <div class="admin-menu-item" :class="{ active: activeMenu === 'announcements' }" @click="activeMenu = 'announcements'; loadAnnouncements()">📢 公告管理</div>
      <div class="admin-menu-item" :class="{ active: activeMenu === 'logs' }" @click="activeMenu = 'logs'; loadBattleLogs()">⚔️ 战斗日志</div>
      <div style="margin-top: 20px;"><button class="btn btn-secondary" @click="goBack">返回游戏</button></div>
    </div>

    <div class="admin-content">
      <!-- ====== Dashboard ====== -->
      <div v-if="activeMenu === 'dashboard'">
        <h2 class="admin-title">运营控制台</h2>
        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px;">
          <div v-for="card in dashCards" :key="card.label" class="dash-card">
            <div class="dash-card-label">{{ card.label }}</div>
            <div class="dash-card-value" :style="{ color: card.color }">{{ card.value }}</div>
          </div>
        </div>
        <div style="background: #16213e; border-radius: 8px; padding: 20px;">
          <h4 style="color: #ffd700; margin-bottom: 15px;">最近7天日活趋势</h4>
          <div style="display: flex; align-items: flex-end; gap: 8px; height: 150px;">
            <div v-for="d in dashboard.dailyActive" :key="d.date" style="flex:1; display:flex; flex-direction:column; align-items:center;">
              <div style="font-size: 12px; color:#aaa; margin-bottom:4px;">{{ d.count }}</div>
              <div :style="{ height: Math.max(4, d.count * 3) + 'px', width:'100%', background:'#e94560', borderRadius:'4px 4px 0 0', minHeight:'4px' }"></div>
              <div style="font-size: 10px; color:#666; margin-top:4px;">{{ d.date.slice(5) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ====== 玩家管理 ====== -->
      <div v-if="activeMenu === 'players'">
        <div class="admin-header">
          <h2 class="admin-title">玩家管理</h2>
          <div>
            <input v-model="searchQuery" type="text" placeholder="搜索玩家..." style="padding: 8px; margin-right: 10px;" />
            <select v-model="filterFaction" style="padding: 8px; margin-right: 10px; background:#0f3460; color:#eee; border:1px solid #1a4a7a;">
              <option value="">全部门派</option>
              <option value="shaolin">少林</option><option value="wudang">武当</option><option value="emei">峨眉</option>
              <option value="beggar">丐帮</option><option value="mingjiao">明教</option><option value="xiaoyao">逍遥</option>
            </select>
            <button class="btn" style="width:auto; padding:8px 15px;" @click="searchPlayers">搜索</button>
          </div>
        </div>
        <table class="data-table">
          <thead><tr><th>角色名</th><th>等级</th><th>门派</th><th>状态</th><th>金币</th><th>注册时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="p in players" :key="p._id">
              <td>{{ p.characterName }}</td><td>{{ p.level }}</td><td>{{ p.faction || '无' }}</td>
              <td>{{ p.status }}</td><td>{{ p.gold }}</td><td>{{ formatDate(p.createdAt) }}</td>
              <td>
                <button @click="viewPlayerDetail(p._id)" style="margin-right:3px;">详情</button>
                <button @click="giveGold(p._id)" style="margin-right:3px;">发金</button>
                <button @click="banPlayer(p._id, p.status)" style="margin-right:3px;">{{ p.status === 'banned' ? '解封' : '封禁' }}</button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 玩家详情弹窗 -->
        <div v-if="playerDetail" class="modal-overlay" @click.self="playerDetail = null">
          <div class="modal-content">
            <h3 style="color:#e94560; margin-bottom:15px;">{{ playerDetail.player?.characterName }} 详情</h3>
            <div v-if="playerDetail.player" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="info-block"><b>等级:</b> {{ playerDetail.player.level }} | <b>经验:</b> {{ playerDetail.player.exp }}</div>
              <div class="info-block"><b>HP:</b> {{ playerDetail.player.hp?.current }}/{{ playerDetail.player.hp?.max }} | <b>MP:</b> {{ playerDetail.player.mp?.current }}/{{ playerDetail.player.mp?.max }}</div>
              <div class="info-block"><b>金币:</b> {{ playerDetail.player.gold }} | <b>门派:</b> {{ playerDetail.player.faction || '无' }} {{ playerDetail.player.factionRank }}</div>
              <div class="info-block"><b>力量:</b> {{ playerDetail.player.attributes?.strength }} | <b>敏捷:</b> {{ playerDetail.player.attributes?.dexterity }} | <b>体质:</b> {{ playerDetail.player.attributes?.constitution }} | <b>悟性:</b> {{ playerDetail.player.attributes?.intelligence }}</div>
              <div class="info-block"><b>自由点:</b> {{ playerDetail.player.freePoints }} | <b>位置:</b> {{ playerDetail.player.location?.roomId }}</div>
            </div>
            <h4 style="color:#ffd700; margin-top:15px;">装备 ({{ playerDetail.equipment?.length || 0 }})</h4>
            <div v-for="e in playerDetail.equipment" :key="e._id" style="font-size:13px; color:#aaa;">{{ e.itemId }} [{{ e.equipSlot }}] 耐久:{{ e.durability?.current }}/{{ e.durability?.max }}</div>

            <h4 style="color:#ffd700; margin-top:15px;">GM 操作</h4>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
              <button @click="gmAction(playerDetail.player._id, 'gold')">±金币</button>
              <button @click="gmAction(playerDetail.player._id, 'exp')">±经验</button>
              <button @click="gmAction(playerDetail.player._id, 'level')">设等级</button>
              <button @click="gmAction(playerDetail.player._id, 'teleport')">传送</button>
              <button @click="gmAction(playerDetail.player._id, 'giveItem')">发物品</button>
              <button @click="gmAction(playerDetail.player._id, 'reset')" style="background:#e94560;">重置</button>
            </div>
            <button class="btn btn-secondary" style="margin-top:20px;" @click="playerDetail = null">关闭</button>
          </div>
        </div>
      </div>

      <!-- ====== 行为日志 ====== -->
      <div v-if="activeMenu === 'actionLogs'">
        <h2 class="admin-title">玩家行为日志</h2>
        <div style="display:flex; gap:8px; margin-bottom:15px; flex-wrap:wrap; align-items:center;">
          <input v-model="logFilter.characterName" placeholder="角色名" style="padding:6px; width:120px;" />
          <select v-model="logFilter.category" style="padding:6px; background:#0f3460; color:#eee; border:1px solid #1a4a7a;">
            <option value="">全部分类</option>
            <option value="combat">战斗</option><option value="economy">经济</option><option value="movement">移动</option>
            <option value="skill">技能</option><option value="quest">任务</option><option value="faction">门派</option>
            <option value="chat">聊天</option><option value="system">系统</option><option value="gm_action">GM操作</option>
          </select>
          <input v-model="logFilter.keyword" placeholder="关键词" style="padding:6px; width:120px;" />
          <button class="btn" style="width:auto; padding:6px 12px;" @click="logFilter.page = 1; loadActionLogs()">查询</button>
        </div>
        <table class="data-table">
          <thead><tr><th>时间</th><th>角色</th><th>分类</th><th>动作</th><th>详情</th><th>位置</th></tr></thead>
          <tbody>
            <tr v-for="l in actionLogs" :key="l._id">
              <td style="font-size:12px;">{{ formatDate(l.createdAt) }}</td>
              <td>{{ l.characterName }}</td>
              <td>{{ l.category }}</td><td>{{ l.action }}</td>
              <td style="font-size:12px; max-width:300px; overflow:hidden; text-overflow:ellipsis;">{{ JSON.stringify(l.details) }}</td>
              <td style="font-size:11px;">{{ l.roomId }}</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:10px;">共 {{ actionLogTotal }} 条 | 页 {{ logFilter.page }}/{{ Math.ceil(actionLogTotal/50) || 1 }}
          <button @click="logFilter.page--; loadActionLogs()" :disabled="logFilter.page<=1" style="margin-left:8px;">上一页</button>
          <button @click="logFilter.page++; loadActionLogs()" :disabled="logFilter.page >= Math.ceil(actionLogTotal/50)">下一页</button>
        </div>
      </div>

      <!-- ====== 任务配置 ====== -->
      <div v-if="activeMenu === 'questConfig'">
        <h2 class="admin-title">任务配置管理</h2>
        <button class="btn" style="width:auto; padding:8px 15px; margin-bottom:10px;" @click="editingQuest = {}; originalQuestId = null; showQuestEditor = true;">+ 新建任务</button>
        <table class="data-table">
          <thead><tr><th>ID</th><th>名称</th><th>类型</th><th>目标</th><th>奖励</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="q in questConfigs" :key="q.id">
              <td>{{ q.id }}</td><td>{{ q.name }}</td><td>{{ q.type }}</td>
              <td style="font-size:12px;">{{ q.objectives?.map(o => o.type + ':' + (o.npcId || o.monsterId || '')).join(', ') }}</td>
              <td style="font-size:12px;">exp:{{ q.rewards?.exp }} gold:{{ q.rewards?.gold }}</td>
              <td>
                <button @click="editingQuest = JSON.parse(JSON.stringify(q)); originalQuestId = q.id; showQuestEditor = true;" style="margin-right:3px;">编辑</button>
                <button @click="deleteQuestConfig(q.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <!-- 任务编辑弹窗 -->
        <div v-if="showQuestEditor" class="modal-overlay" @click.self="showQuestEditor = false">
          <div class="modal-content" style="max-width:600px;">
            <h3>{{ editingQuest.id ? '编辑任务' : '新建任务' }}</h3>
            <div class="form-group"><label>ID</label><input v-model="editingQuest.id" :disabled="!!originalQuestId" /></div>
            <div class="form-group"><label>名称</label><input v-model="editingQuest.name" /></div>
            <div class="form-group"><label>描述</label><textarea v-model="editingQuest.description" rows="2"></textarea></div>
            <div class="form-group"><label>类型</label><input v-model="editingQuest.type" /></div>
            <div class="form-group"><label>目标 (JSON)</label><textarea v-model="editingQuest.objectivesStr" rows="3" placeholder='[{"type":"kill","monsterId":"monster_wild_wolf","count":3}]'></textarea></div>
            <div class="form-group"><label>奖励 (JSON)</label><textarea v-model="editingQuest.rewardsStr" rows="2" placeholder='{"exp":100,"gold":50}'></textarea></div>
            <button class="btn" @click="saveQuestConfig">保存</button>
            <button class="btn btn-secondary" @click="showQuestEditor = false" style="margin-left:10px;">取消</button>
          </div>
        </div>
      </div>

      <!-- ====== 道具配置 ====== -->
      <div v-if="activeMenu === 'itemConfig'">
        <h2 class="admin-title">道具配置管理</h2>
        <button class="btn" style="width:auto; padding:8px 15px; margin-bottom:10px;" @click="editingItem = {}; showItemEditor = true;">+ 新建道具</button>
        <select v-model="itemTypeFilter" @change="loadItemConfigs()" style="padding:6px; margin-left:10px; background:#0f3460; color:#eee; border:1px solid #1a4a7a;">
          <option value="">全部类型</option><option value="weapon">武器</option><option value="armor">防具</option><option value="consumable">消耗品</option><option value="material">材料</option><option value="equipment">装备</option>
        </select>
        <table class="data-table">
          <thead><tr><th>ID</th><th>名称</th><th>类型</th><th>价格</th><th>等级要求</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in itemConfigs" :key="item.id">
              <td>{{ item.id }}</td><td>{{ item.name }}</td><td>{{ item.type }}</td><td>{{ item.price }}</td><td>{{ item.requireLevel || '-' }}</td>
              <td>
                <button @click="editingItem = JSON.parse(JSON.stringify(item)); showItemEditor = true;" style="margin-right:3px;">编辑</button>
                <button @click="deleteItemConfig(item.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="showItemEditor" class="modal-overlay" @click.self="showItemEditor = false">
          <div class="modal-content" style="max-width:600px;">
            <h3>{{ editingItem.id && itemConfigs.find(i=>i.id===editingItem.id) ? '编辑道具' : '新建道具' }}</h3>
            <div class="form-group"><label>ID</label><input v-model="editingItem.id" /></div>
            <div class="form-group"><label>名称</label><input v-model="editingItem.name" /></div>
            <div class="form-group"><label>类型</label><select v-model="editingItem.type"><option value="weapon">武器</option><option value="armor">防具</option><option value="consumable">消耗品</option><option value="material">材料</option><option value="equipment">装备</option></select></div>
            <div class="form-group"><label>价格</label><input v-model.number="editingItem.price" type="number" /></div>
            <div class="form-group"><label>等级要求</label><input v-model.number="editingItem.requireLevel" type="number" /></div>
            <button class="btn" @click="saveItemConfig">保存</button>
            <button class="btn btn-secondary" @click="showItemEditor = false" style="margin-left:10px;">取消</button>
          </div>
        </div>
      </div>

      <!-- ====== 地图管理（重构） ====== -->
      <div v-if="activeMenu === 'maps'">
        <h2 class="admin-title">地图管理</h2>
        <div style="display:flex;gap:8px;margin-bottom:15px;align-items:center;">
          <button :class="mapViewMode === 'cards' ? 'btn' : 'btn btn-secondary'" @click="mapViewMode = 'cards'" style="width:auto;padding:6px 15px;">🗺️ 卡片视图</button>
          <button :class="mapViewMode === 'overview' ? 'btn' : 'btn btn-secondary'" @click="switchToOverview()" style="width:auto;padding:6px 15px;">📋 全貌视图</button>
        </div>
        <div v-if="mapViewMode === 'cards'">
        <div class="maps-grid">
          <div v-for="map in maps" :key="map.id" class="map-card" :class="{ selected: selectedMap?.id === map.id }" @click="selectMap(map)">
            <div class="map-card-header"><span class="map-name">{{ map.name }}</span><span class="map-level">{{ map.level }}</span></div>
            <div class="map-card-desc">{{ map.description }}</div>
            <div class="map-card-rooms">房间: {{ map.rooms?.length || 0 }} | 入口: {{ allRoomNames[map.entryRoom] || map.entryRoom || '-' }}</div>
          </div>
          <div class="map-card map-card-new" @click="createMap">
            <div class="map-card-header" style="font-size:24px;justify-content:center;">+ 新建地图</div>
          </div>
        </div>

        <!-- 地图详情 -->
        <div v-if="selectedMap" class="map-detail">
          <h3>{{ isEditingMap ? '编辑' : '' }}{{ selectedMap.name || '新建地图' }}</h3>
          <div class="form-group"><label>地图ID</label><input v-model="selectedMap.id" :disabled="!isNewMap" /></div>
          <div class="form-group"><label>名称</label><input v-model="selectedMap.name" /></div>
          <div class="form-group"><label>描述</label><textarea v-model="selectedMap.description" rows="2"></textarea></div>
          <div class="form-group"><label>等级范围</label><input v-model="selectedMap.level" placeholder="1-10" /></div>
          <div class="form-group">
            <label>入口房间（地图作为房间的方向目标）</label>
            <select v-model="selectedMap.entryRoom">
              <option value="">-- 选择入口房间 --</option>
              <option v-for="r in mapRooms" :key="r.id" :value="r.id">{{ r.name }} ({{ r.id }})</option>
            </select>
          </div>
          <button class="btn" @click="saveMap" style="margin-top:8px;">💾 保存地图</button>

          <!-- 房间管理 -->
          <h4 style="color:#ffd700; margin-top:20px;">📁 房间管理</h4>
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
            <select v-model="selectedRoomId" @change="onRoomSelect" style="flex:1; padding:8px; background:#0f3460; color:#eee; border:1px solid #1a4a7a; border-radius:5px;">
              <option value="">-- 选择房间 --</option>
              <option v-for="r in mapRooms" :key="r.id" :value="r.id">{{ r.name }} ({{ r.id }})</option>
            </select>
            <button @click="editSelectedRoom" :disabled="!selectedRoomId">✏️ 编辑</button>
            <button @click="createRoom">+ 新建房间</button>
          </div>
          <div class="rooms-list">
            <div v-for="room in mapRooms" :key="room.id" class="room-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;">
              <div>
                <span class="room-name">{{ room.name }}</span>
                <span style="color:#888;font-size:11px;"> ({{ room.id }})</span>
                <div style="color:#888;font-size:11px;">
                  出口: {{ room.exits?.length || 0 }} | NPC: {{ room.npcs?.length || 0 }} | 怪物: {{ room.monsters?.length || 0 }}
                </div>
              </div>
              <div style="display:flex;gap:4px;">
                <button @click="editRoom(room)" style="font-size:11px;">✏️</button>
                <button @click="deleteRoom(room.id)" style="font-size:11px;background:#e94560;">🗑️</button>
              </div>
            </div>
            <div v-if="!mapRooms.length" style="color:#666;text-align:center;padding:20px;">暂无房间，点击「新建房间」创建</div>
          </div>

          <!-- 地图级怪物 -->
          <h4 style="color:#ffd700; margin-top:20px;">👹 地图怪物</h4>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
            <span v-for="(m, i) in (selectedMap.monsters || [])" :key="i" class="tag">
              {{ monsterNames[m.monsterId] || m.monsterId }} (权重{{ m.spawnWeight || 1 }})
              <button @click="removeMapMonster(i)" style="background:none;border:none;color:#e94560;cursor:pointer;padding:0 2px;">×</button>
            </span>
          </div>
          <button @click="openMonsterPicker('map')" class="btn" style="width:auto;padding:6px 12px;">+ 添加怪物</button>
        </div>
        </div>  <!-- end cards view -->

        <!-- 房间编辑弹窗 -->
        <div v-if="showRoomEditor" class="modal-overlay" @click.self="showRoomEditor = false">
          <div class="modal-content" style="max-width:700px;max-height:85vh;">
            <h3>{{ isNewRoom ? '新建房间' : '编辑房间' }} <span v-if="!isNewRoom" style="color:#888;font-size:14px;">{{ editingRoom.id }}</span></h3>
            <div class="form-group"><label>房间ID</label><input v-model="editingRoom.id" :disabled="!isNewRoom" /></div>
            <div class="form-group"><label>名称</label><input v-model="editingRoom.name" /></div>
            <div class="form-group"><label>描述</label><textarea v-model="editingRoom.description" rows="2"></textarea></div>

            <!-- 方向 -->
            <h4 style="color:#ffd700;margin-top:12px;">🧭 出入口</h4>
            <div v-for="(exit, i) in (editingRoom.exits || [])" :key="i" style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap;">
              <select v-model="exit.direction" style="width:100px;padding:6px;background:#0f3460;color:#eee;border:1px solid #1a4a7a;">
                <option v-for="d in DIR_OPTIONS" :key="d" :value="d">{{ d }}</option>
              </select>
              <span style="color:#888;">→</span>
              <select v-model="exit.targetMapId" @change="onExitMapChange(i)" style="flex:1;min-width:120px;padding:6px;background:#0f3460;color:#eee;border:1px solid #1a4a7a;">
                <option value="">选择地图</option>
                <option v-for="m in maps" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
              <select v-model="exit.roomId" style="flex:1;min-width:120px;padding:6px;background:#0f3460;color:#eee;border:1px solid #1a4a7a;">
                <option value="">选择房间</option>
                <option v-if="exit.targetMap" :value="exit.targetMap.entryRoom">🏠 {{ exit.targetMap.name }}（地图入口）</option>
                <option v-for="r in exitRoomOptions(i)" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
              <button @click="removeExit(i)" style="font-size:12px;color:#e94560;">×</button>
            </div>
            <button @click="addExit" class="btn" style="width:auto;padding:4px 10px;font-size:12px;">+ 添加方向</button>

            <!-- NPC -->
            <h4 style="color:#ffd700;margin-top:12px;">👤 NPC</h4>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
              <span v-for="(nid, i) in (editingRoom.npcs || [])" :key="i" class="tag">
                {{ npcNames[nid] || nid }}
                <button @click="removeRoomNpc(i)" style="background:none;border:none;color:#e94560;cursor:pointer;padding:0 2px;">×</button>
              </span>
            </div>
            <button @click="openNpcPicker" class="btn" style="width:auto;padding:6px 12px;">+ 添加NPC</button>

            <!-- 怪物 -->
            <h4 style="color:#ffd700;margin-top:12px;">👹 房间怪物</h4>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
              <span v-for="(m, i) in (editingRoom.monsters || [])" :key="i" class="tag">
                {{ monsterNames[m.monsterId] || m.monsterId }} ({{ m.spawnWeight || 1 }})
                <button @click="removeRoomMonster(i)" style="background:none;border:none;color:#e94560;cursor:pointer;padding:0 2px;">×</button>
              </span>
            </div>
            <button @click="openMonsterPicker('room')" class="btn" style="width:auto;padding:6px 12px;">+ 添加怪物</button>

            <!-- 自动聚合功能 -->
            <h4 style="color:#888;margin-top:12px;font-size:13px;">⚙️ 房间功能（NPC聚合）</h4>
            <div style="color:#aaa;font-size:12px;">
              <template v-if="editingRoom.npcs?.length">
                <span v-for="nid in editingRoom.npcs" :key="nid">
                  <template v-for="svc in (allNpcServices[nid] || [])" :key="svc">
                    <span class="tag" style="background:#1a3a5a;">{{ svc }}</span>
                  </template>
                </span>
              </template>
              <span v-else>（无NPC）</span>
            </div>

            <button class="btn" @click="saveRoom" style="margin-top:15px;">{{ isNewRoom ? '创建' : '保存' }}</button>
            <button class="btn btn-secondary" @click="showRoomEditor = false" style="margin-left:10px;">取消</button>
          </div>
        </div>

        <!-- NPC选择弹窗 -->
        <div v-if="showNpcPicker" class="modal-overlay" @click.self="showNpcPicker = false">
          <div class="modal-content" style="max-width:500px;max-height:70vh;">
            <h3>选择NPC</h3>
            <input v-model="npcSearch" placeholder="搜索NPC名称或ID..." style="width:100%;margin-bottom:10px;padding:8px;background:#0f3460;border:1px solid #1a4a7a;color:#eee;" />
            <div style="max-height:350px;overflow-y:auto;">
              <div v-for="npc in filteredNpcs" :key="npc.id" style="display:flex;align-items:center;padding:6px;border-bottom:1px solid #1a1a40;cursor:pointer;" @click="toggleNpc(npc.id)">
                <input type="checkbox" :checked="selectedNpcIds.includes(npc.id)" @click.stop="toggleNpc(npc.id)" />
                <div>
                  <div style="font-weight:bold;">{{ npc.name }}</div>
                  <div style="font-size:11px;color:#888;">{{ npc.id }} | {{ npc.type || '?' }} | {{ (npc.services || []).join(', ') || '无服务' }} | 出现: {{ (npc.roomIds || []).length }}房间</div>
                </div>
              </div>
            </div>
            <div style="margin-top:8px;color:#aaa;font-size:12px;">已选 {{ selectedNpcIds.length }} 个</div>
            <button class="btn" @click="confirmNpcSelection">确认选择</button>
            <button class="btn btn-secondary" @click="showNpcPicker = false" style="margin-left:10px;">取消</button>
          </div>
        </div>

        <!-- 怪物选择弹窗 -->
        <div v-if="showMonsterPicker" class="modal-overlay" @click.self="showMonsterPicker = false">
          <div class="modal-content" style="max-width:500px;max-height:70vh;">
            <h3>添加怪物</h3>
            <input v-model="monsterSearch" placeholder="搜索怪物名称或ID..." style="width:100%;margin-bottom:10px;padding:8px;background:#0f3460;border:1px solid #1a4a7a;color:#eee;" />
            <div style="max-height:350px;overflow-y:auto;">
              <div v-for="mon in filteredMonsters" :key="mon.id" style="display:flex;align-items:center;padding:6px;border-bottom:1px solid #1a1a40;cursor:pointer;" @click="addMonster(mon)">
                <div style="flex:1;">
                  <div style="font-weight:bold;">{{ mon.name }}</div>
                  <div style="font-size:11px;color:#888;">{{ mon.id }} | Lv{{ mon.level }} | HP:{{ mon.hp }} ATK:{{ mon.attack }}</div>
                </div>
                <span style="color:#4fc3f7;font-size:12px;margin-left:8px;">点击添加</span>
              </div>
            </div>
            <div v-if="pendingMonsterId" style="margin-top:8px;display:flex;gap:8px;align-items:center;">
              <span style="color:#ffd700;">{{ monsterNames[pendingMonsterId] }} — 刷怪权重:</span>
              <input v-model.number="pendingMonsterWeight" type="number" min="1" max="10" style="width:60px;padding:4px;background:#0f3460;color:#eee;border:1px solid #1a4a7a;" />
              <button class="btn" @click="confirmAddMonster">确认</button>
              <button class="btn btn-secondary" @click="pendingMonsterId = null">取消</button>
            </div>
            <button class="btn btn-secondary" @click="showMonsterPicker = false">关闭</button>
          </div>
        </div>

        <!-- ====== 全貌视图：SVG 总览图 ====== -->
        <div v-if="mapViewMode === 'overview'" class="map-overview-svg">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="color:#888;font-size:13px;">MAP: {{ maps.length }} | ROOM: {{ totalRoomCount }} | 入口房间高亮 🟡 | 跨地图连线 <span style="color:#ff9800;">━━━</span></span>
            <a href="/map-overview.svg" download target="_blank" class="btn" style="width:auto;padding:6px 15px;text-decoration:none;">📥 下载 SVG</a>
          </div>
          <div class="svg-container" style="background:#0a0a1a;border-radius:8px;overflow:auto;max-height:70vh;">
            <img src="/map-overview.svg" alt="地图总览" style="width:100%;min-width:800px;" />
          </div>
        </div>

      </div>

      <div v-if="activeMenu === 'announcements'">
        <div class="admin-header"><h2 class="admin-title">公告管理</h2><button class="btn" style="width:auto; padding:8px 15px;" @click="showCreateAnnouncement = true">发布公告</button></div>
        <div v-if="showCreateAnnouncement" style="background:#16213e; padding:20px; border-radius:5px; margin-bottom:20px;">
          <div class="form-group"><label>标题</label><input v-model="newAnnouncement.title" /></div>
          <div class="form-group"><label>内容</label><textarea v-model="newAnnouncement.content" rows="5"></textarea></div>
          <div class="form-group"><label>类型</label><select v-model="newAnnouncement.type"><option value="normal">普通</option><option value="important">重要</option><option value="urgent">紧急</option><option value="event">活动</option></select></div>
          <button class="btn" @click="createAnnouncement">发布</button><button class="btn btn-secondary" @click="showCreateAnnouncement = false" style="margin-left:10px;">取消</button>
        </div>
        <table class="data-table">
          <thead><tr><th>标题</th><th>类型</th><th>发布者</th><th>时间</th><th>操作</th></tr></thead>
          <tbody><tr v-for="a in announcements" :key="a._id"><td>{{ a.title }}</td><td>{{ a.type }}</td><td>{{ a.authorName }}</td><td>{{ formatDate(a.createdAt) }}</td><td><button @click="deleteAnnouncement(a._id)">删除</button></td></tr></tbody>
        </table>
      </div>

      <!-- ====== 战斗日志 ====== -->
      <div v-if="activeMenu === 'logs'">
        <h2 class="admin-title">战斗日志</h2>
        <table class="data-table">
          <thead><tr><th>战斗ID</th><th>类型</th><th>参与者</th><th>胜利者</th><th>回合</th><th>时间</th></tr></thead>
          <tbody><tr v-for="l in battleLogs" :key="l._id"><td>{{ l.battleId?.substring(0,8) }}</td><td>{{ l.type }}</td><td>{{ l.participants?.map(p=>p.name).join(',') }}</td><td>{{ l.result?.winner }}</td><td>{{ l.rounds?.length }}</td><td>{{ formatDate(l.startedAt) }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const activeMenu = ref('dashboard')

// Dashboard
const dashboard = ref({ dailyActive: [] })
const dashCards = ref([])
async function loadDashboard() {
  try {
    const { data } = await axios.get('/gm/statistics/full')
    const d = data.data
    dashboard.value = d
    dashCards.value = [
      { label: '总玩家', value: d.totalPlayers, color: '#e94560' },
      { label: '在线', value: d.onlinePlayers, color: '#4fc3f7' },
      { label: '今日新增', value: d.newToday, color: '#ffd700' },
      { label: '今日活跃', value: d.activeToday, color: '#69f0ae' },
      { label: '今日战斗', value: d.battlesToday, color: '#ff9800' },
      { label: '今日交易', value: d.tradesToday, color: '#ce93d8' }
    ]
  } catch (e) { console.error(e) }
}

// 玩家
const searchQuery = ref(''), filterFaction = ref('')
const players = ref([]), playerDetail = ref(null)
async function loadPlayers() { try { players.value = (await axios.get('/gm/players')).data.data.players } catch(e) {} }
async function searchPlayers() {
  try { const p = { search: searchQuery.value }; if (filterFaction.value) p.faction = filterFaction.value; players.value = (await axios.get('/gm/players', { params: p })).data.data.players } catch(e) {}
}
async function viewPlayerDetail(id) { try { playerDetail.value = (await axios.get(`/gm/players/${id}/full`)).data.data } catch(e) { alert('加载失败') } }
async function giveGold(id) { const a = prompt('金币数量:'); if (!a) return; try { await axios.post(`/gm/players/${id}/gold`, { amount: parseInt(a) }); alert('成功'); loadPlayers() } catch(e) { alert(e.response?.data?.message) } }
async function banPlayer(id, status) {
  const banned = status !== 'banned'
  if (!confirm(`${banned ? '封禁' : '解封'}该玩家？`)) return
  try { await axios.post(`/gm/players/${id}/ban`, { banned, reason: '' }); loadPlayers() } catch(e) { alert('操作失败') }
}
async function gmAction(id, action) {
  const body = {}
  switch (action) {
    case 'gold': { const v = prompt('金币变动 (±):', '0'); if (v == null) return; body.gold = parseInt(v); break }
    case 'exp': { const v = prompt('经验变动 (±):', '0'); if (v == null) return; body.exp = parseInt(v); break }
    case 'level': { const v = prompt('设置等级 (1-100):', ''); if (v == null) return; body.level = parseInt(v); break }
    case 'teleport': { const v = prompt('传送到房间ID:', 'village_center'); if (!v) return; body.teleportTo = v; break }
    case 'giveItem': { const itemId = prompt('物品ID:'); if (!itemId) return; const qty = prompt('数量:', '1'); body.giveItemId = itemId; body.giveItemQty = parseInt(qty) || 1; break }
    case 'reset': if (!confirm('确定重置该玩家？(回村/满血/状态online)')) return; try { await axios.post(`/gm/players/${id}/reset`); alert('重置成功'); viewPlayerDetail(id) } catch(e) { alert(e.response?.data?.message) } return
  }
  try { await axios.put(`/gm/players/${id}/attributes`, body); alert('操作成功'); viewPlayerDetail(id) } catch(e) { alert(e.response?.data?.message) }
}

// 行为日志
const actionLogs = ref([]), actionLogTotal = ref(0)
const logFilter = ref({ characterName: '', category: '', keyword: '', page: 1 })
async function loadActionLogs() {
  try { const { data } = await axios.get('/gm/action-logs', { params: logFilter.value }); actionLogs.value = data.data.logs; actionLogTotal.value = data.data.total } catch(e) {}
}

// 任务配置
const questConfigs = ref([]), showQuestEditor = ref(false), editingQuest = ref({}), originalQuestId = ref(null)
async function loadQuestConfigs() { try { questConfigs.value = (await axios.get('/gm/config/quests')).data.data } catch(e) {} }
async function saveQuestConfig() {
  const q = editingQuest.value
  try {
    if (q.objectivesStr) q.objectives = JSON.parse(q.objectivesStr)
    if (q.rewardsStr) q.rewards = JSON.parse(q.rewardsStr)
    if (questConfigs.value.find(x => x.id === q.id)) { await axios.put(`/gm/config/quests/${q.id}`, q) }
    else { await axios.post('/gm/config/quests', q) }
    showQuestEditor.value = false; originalQuestId.value = null; loadQuestConfigs()
  } catch(e) { alert('保存失败: ' + (e.response?.data?.message || e.message)) }
}
async function deleteQuestConfig(id) { if (!confirm('删除任务 ' + id + '?')) return; try { await axios.delete(`/gm/config/quests/${id}`); loadQuestConfigs() } catch(e) { alert('删除失败') } }

// 道具配置
const itemConfigs = ref([]), showItemEditor = ref(false), editingItem = ref({}), itemTypeFilter = ref('')
async function loadItemConfigs() {
  try { const p = {}; if (itemTypeFilter.value) p.type = itemTypeFilter.value; itemConfigs.value = (await axios.get('/gm/config/items', { params: p })).data.data } catch(e) {}
}
async function saveItemConfig() {
  const item = editingItem.value
  try {
    if (itemConfigs.value.find(x => x.id === item.id)) { await axios.put(`/gm/config/items/${item.id}`, item) }
    else { await axios.post('/gm/config/items', item) }
    showItemEditor.value = false; loadItemConfigs()
  } catch(e) { alert('保存失败: ' + (e.response?.data?.message || e.message)) }
}
async function deleteItemConfig(id) { if (!confirm('删除道具 ' + id + '?')) return; try { await axios.delete(`/gm/config/items/${id}`); loadItemConfigs() } catch(e) { alert('删除失败') } }

// 地图（重构）
const DIR_OPTIONS = ['north', 'south', 'east', 'west', 'up', 'down', 'enter', 'out', 'north_east', 'north_west', 'south_east', 'south_west']
const maps = ref([]), mapRooms = ref([]), selectedMap = ref(null), selectedRoomId = ref('')
const mapViewMode = ref('cards') // 'cards' | 'overview'
const showRoomEditor = ref(false), editingRoom = ref({}), isNewRoom = ref(false), isNewMap = ref(false)
const allNpcs = ref([]), allMonsters = ref([])
const showNpcPicker = ref(false), selectedNpcIds = ref([]), npcSearch = ref('')
const showMonsterPicker = ref(false), monsterPickerTarget = ref(''), pendingMonsterId = ref(null), pendingMonsterWeight = ref(5)
const monsterSearch = ref('')

// 所有房间名称查找表 (roomId → name)
const allRoomNames = ref({})
const totalRoomCount = computed(() => Object.keys(allRoomNames.value).length)

async function loadMaps() {
  try { maps.value = (await axios.get('/gm/config/maps')).data.data } catch(e) {}
  // 全量加载房间并构建 roomId→name 查找表
  try {
    const { data } = await axios.get('/gm/config/rooms')
    const lookup = {}
    const byMap = {}
    for (const r of (data.data || [])) {
      lookup[r.id] = r.name
      if (!byMap[r.mapId]) byMap[r.mapId] = []
      byMap[r.mapId].push(r)
      allRoomsLookup.value[r.id] = { mapId: r.mapId, room: r }
    }
    allRoomNames.value = lookup
    exitRoomCache.value = byMap
  } catch(e) { console.error('loadMaps rooms failed:', e) }
  // 预加载 NPC / 怪物列表，避免编辑器弹窗为空
  if (allNpcs.value.length === 0) loadAllNpcs()
  if (allMonsters.value.length === 0) loadAllMonsters()
}
async function selectMap(map) {
  selectedMap.value = JSON.parse(JSON.stringify(map))
  isNewMap.value = false
  selectedRoomId.value = ''
  await loadRoomsForMap(map.id)
  await loadAllNpcs()
  await loadAllMonsters()
}
function createMap() {
  selectedMap.value = { id: '', name: '', description: '', level: '1-10', entryRoom: '', rooms: [], monsters: [], npcs: [] }
  isNewMap.value = true
  selectedRoomId.value = ''
  mapRooms.value = []
}
async function saveMap() {
  const m = selectedMap.value
  if (!m.id || !m.name) return alert('地图ID和名称不能为空')
  try {
    if (isNewMap.value) {
      await axios.post('/gm/config/maps', m)
    } else {
      await axios.put(`/gm/config/maps/${m.id}`, m)
    }
    isNewMap.value = false
    await loadMaps()
    // 刷新 selectedMap 以获取最新的 rooms 列表
    const updated = maps.value.find(m => m.id === selectedMap.value.id)
    if (updated) selectedMap.value = JSON.parse(JSON.stringify(updated))
  } catch(e) { alert('保存失败: ' + (e.response?.data?.message || e.message)) }
}
async function loadAllNpcs() {
  try { allNpcs.value = (await axios.get('/gm/config/npcs')).data.data } catch(e) { alert('加载NPC列表失败: ' + (e.response?.data?.message || e.message)) }
}
async function loadAllMonsters() {
  try { allMonsters.value = (await axios.get('/gm/config/monsters')).data.data } catch(e) { alert('加载怪物列表失败: ' + (e.response?.data?.message || e.message)) }
}

// ============ 房间操作（重构版）============
const allRoomsLookup = ref({}) // roomId → { mapId, room }
const exitRoomCache = ref({})  // mapId → rooms[]

// 全量加载所有房间，构建 roomId→mapId 查找表，同时按地图分组缓存
async function loadAllRoomsLookup() {
  try {
    const { data } = await axios.get('/gm/config/rooms')
    const rooms = data.data || []
    const lookup = {}
    const byMap = {}
    for (const r of rooms) {
      lookup[r.id] = { mapId: r.mapId, room: r }
      if (!byMap[r.mapId]) byMap[r.mapId] = []
      byMap[r.mapId].push(r)
    }
    allRoomsLookup.value = lookup
    exitRoomCache.value = byMap
  } catch(e) {}
}

// 加载指定地图的房间。onlyCache=true 时仅更新缓存不覆盖当前 mapRooms 显示
async function loadRoomsForMap(mapId, { onlyCache = false } = {}) {
  try {
    const { data } = await axios.get('/gm/config/rooms', { params: { mapId } })
    const rooms = data.data || []
    exitRoomCache.value[mapId] = rooms
    if (!onlyCache) mapRooms.value = rooms
    for (const r of rooms) {
      allRoomsLookup.value[r.id] = { mapId: r.mapId, room: r }
      allRoomNames.value[r.id] = r.name
    }
  } catch(e) {}
}

// 统一的后刷新：清缓存 + 重载数据 + 同步 selectedMap
async function refreshAfterRoomCRUD() {
  exitRoomCache.value = {}
  allRoomsLookup.value = {}
  await loadRoomsForMap(selectedMap.value.id)
  await loadMaps()
  const updatedMap = maps.value.find(m => m.id === selectedMap.value.id)
  if (updatedMap) selectedMap.value = JSON.parse(JSON.stringify(updatedMap))
}

// 创建房间 — 不需要加载数据
function createRoom() {
  editingRoom.value = { id: '', name: '', description: '', mapId: selectedMap.value.id, exits: [], npcs: [], monsters: [], features: [] }
  isNewRoom.value = true
  showRoomEditor.value = true
}

// 编辑房间 — 始终从服务器拉最新数据，并自动解析退出方向
async function editRoom(room) {
  editingRoom.value = JSON.parse(JSON.stringify(room))
  isNewRoom.value = false
  showRoomEditor.value = true

  // 全量加载房间查找表
  await loadAllRoomsLookup()

  // 自动为每个 exit 补全 targetMapId 和 targetMap
  for (const exit of (editingRoom.value.exits || [])) {
    if (exit.roomId) {
      const info = allRoomsLookup.value[exit.roomId]
      if (info) {
        exit.targetMapId = info.mapId
        exit.targetMap = maps.value.find(m => m.id === info.mapId)
        // ensure the target map's rooms are cached
        if (!exitRoomCache.value[info.mapId]) {
          exitRoomCache.value[info.mapId] = []
        }
      }
    }
  }
}

// 下拉选择房间后点击「编辑」
async function editSelectedRoom() {
  await loadRoomsForMap(selectedMap.value.id)
  const room = mapRooms.value.find(r => r.id === selectedRoomId.value)
  if (room) await editRoom(room)
}

function onRoomSelect() {}

// ============ 全貌视图 ============
async function switchToOverview() {
  mapViewMode.value = 'overview'
  // Ensure we have all rooms loaded for the SVG
  if (!Object.keys(allRoomsLookup.value).length) await loadAllRoomsLookup()
}

async function deleteRoom(roomId) {
  if (!confirm(`删除房间 ${roomId}？此操作不可撤销。`)) return
  try {
    await axios.delete(`/gm/config/rooms/${roomId}`)
    await refreshAfterRoomCRUD()
  } catch(e) { alert('删除失败: ' + (e.response?.data?.message || e.message)) }
}

// ============ 方向操作 ============
function addExit() {
  if (!editingRoom.value.exits) editingRoom.value.exits = []
  editingRoom.value.exits.push({ direction: 'north', roomId: '', targetMapId: '' })
}
function removeExit(i) { editingRoom.value.exits.splice(i, 1) }
function onExitMapChange(i) {
  const exit = editingRoom.value.exits[i]
  exit.targetMap = maps.value.find(m => m.id === exit.targetMapId)
  exit.roomId = ''
  // 仅加载到缓存，不覆盖当前地图的 mapRooms 显示
  if (exit.targetMapId && !exitRoomCache.value[exit.targetMapId]) {
    loadRoomsForMap(exit.targetMapId, { onlyCache: true })
  }
}
function exitRoomOptions(i) {
  const exit = editingRoom.value.exits[i]
  if (!exit.targetMapId) return []
  return exitRoomCache.value[exit.targetMapId] || []
}

// ============ 保存房间 ============
async function saveRoom() {
  const r = editingRoom.value
  if (!r.id || !r.name) return alert('房间ID和名称不能为空')
  if (!r.mapId) r.mapId = selectedMap.value.id
  // Clean exits (remove UI-only fields)
  r.exits = (r.exits || []).map(e => ({ direction: e.direction, roomId: e.roomId })).filter(e => e.roomId)
  try {
    if (isNewRoom.value) {
      await axios.post('/gm/config/rooms', r)
    } else {
      await axios.put(`/gm/config/rooms/${r.id}`, r)
    }
    showRoomEditor.value = false
    await refreshAfterRoomCRUD()
  } catch(e) { alert('保存失败: ' + (e.response?.data?.message || e.message)) }
}

// NPC操作
async function openNpcPicker() {
  selectedNpcIds.value = [...(editingRoom.value.npcs || [])]
  npcSearch.value = ''
  if (allNpcs.value.length === 0) await loadAllNpcs()
  showNpcPicker.value = true
}
const filteredNpcs = computed(() => {
  if (!npcSearch.value) return allNpcs.value
  const q = npcSearch.value.toLowerCase()
  return allNpcs.value.filter(n => n.id.toLowerCase().includes(q) || n.name.includes(q))
})
function toggleNpc(npcId) {
  const idx = selectedNpcIds.value.indexOf(npcId)
  if (idx >= 0) selectedNpcIds.value.splice(idx, 1)
  else selectedNpcIds.value.push(npcId)
}
function confirmNpcSelection() {
  editingRoom.value.npcs = [...selectedNpcIds.value]
  showNpcPicker.value = false
}
function removeRoomNpc(i) { editingRoom.value.npcs.splice(i, 1) }
const npcNames = computed(() => {
  const m = {}
  for (const n of allNpcs.value) m[n.id] = n.name
  return m
})
const allNpcServices = computed(() => {
  const m = {}
  for (const n of allNpcs.value) m[n.id] = n.services || []
  return m
})

// 怪物操作
function openMonsterPicker(target) {
  monsterPickerTarget.value = target
  monsterSearch.value = ''
  pendingMonsterId.value = null
  if (allMonsters.value.length === 0) loadAllMonsters()
  showMonsterPicker.value = true
}
const filteredMonsters = computed(() => {
  if (!monsterSearch.value) return allMonsters.value
  const q = monsterSearch.value.toLowerCase()
  return allMonsters.value.filter(m => m.id.toLowerCase().includes(q) || m.name.includes(q))
})
const monsterNames = computed(() => {
  const m = {}
  for (const mon of allMonsters.value) m[mon.id] = mon.name
  return m
})
function addMonster(mon) {
  pendingMonsterId.value = mon.id
  pendingMonsterWeight.value = 5
}
function confirmAddMonster() {
  if (!pendingMonsterId.value) return
  const entry = { monsterId: pendingMonsterId.value, spawnWeight: pendingMonsterWeight.value || 5 }
  if (monsterPickerTarget.value === 'map') {
    if (!selectedMap.value.monsters) selectedMap.value.monsters = []
    selectedMap.value.monsters.push(entry)
  } else {
    if (!editingRoom.value.monsters) editingRoom.value.monsters = []
    editingRoom.value.monsters.push(entry)
  }
  pendingMonsterId.value = null
  showMonsterPicker.value = false
}
function removeRoomMonster(i) { editingRoom.value.monsters.splice(i, 1) }
function removeMapMonster(i) { selectedMap.value.monsters.splice(i, 1) }

// 公告
const announcements = ref([]), showCreateAnnouncement = ref(false)
const newAnnouncement = ref({ title: '', content: '', type: 'normal' })
async function loadAnnouncements() { try { announcements.value = (await axios.get('/announcements')).data.data } catch(e) {} }
async function createAnnouncement() {
  try { await axios.post('/gm/announcements', newAnnouncement.value); showCreateAnnouncement.value = false; newAnnouncement.value = { title: '', content: '', type: 'normal' }; loadAnnouncements(); alert('发布成功') } catch(e) { alert('发布失败: ' + e.response?.data?.message) }
}
async function deleteAnnouncement(id) { if (!confirm('删除？')) return; try { await axios.delete(`/gm/announcements/${id}`); loadAnnouncements() } catch(e) {} }

// 战斗日志
const battleLogs = ref([])
async function loadBattleLogs() { try { battleLogs.value = (await axios.get('/gm/battle-logs')).data.data.logs } catch(e) {} }

// 通用
const formatDate = d => d ? new Date(d).toLocaleString('zh-CN') : ''
const goBack = () => router.push('/game')

onMounted(() => { loadDashboard(); loadPlayers(); loadAnnouncements() })
</script>

<style scoped>
.admin-container { display: flex; min-height: 100vh; background: #0f0f23; color: #eee; }
.admin-sidebar { width: 200px; background: #16213e; padding: 20px; border-right: 1px solid #1a1a40; flex-shrink: 0; }
.admin-menu-item { padding: 10px 15px; margin-bottom: 4px; cursor: pointer; border-radius: 5px; transition: background 0.2s; font-size: 14px; }
.admin-menu-item:hover { background: #1a4a7a; }
.admin-menu-item.active { background: #e94560; }
.admin-content { flex: 1; padding: 20px; overflow-y: auto; }
.admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.admin-title { color: #e94560; margin: 0 0 20px 0; }
.dash-card { background: #16213e; padding: 20px; border-radius: 8px; flex: 1; min-width: 140px; text-align: center; }
.dash-card-label { color: #aaa; font-size: 13px; margin-bottom: 8px; }
.dash-card-value { font-size: 28px; font-weight: bold; }
.data-table { width: 100%; border-collapse: collapse; background: #16213e; border-radius: 5px; overflow: hidden; font-size: 13px; }
.data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #1a1a40; }
.data-table th { background: #0f3460; color: #e94560; }
.data-table tr:hover { background: #1a4a7a; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; margin-bottom: 4px; color: #aaa; font-size: 13px; }
.form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px; background: #0f3460; border: 1px solid #1a4a7a; border-radius: 5px; color: #eee; }
.maps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; margin-bottom: 20px; }
.map-card { background: #16213e; border-radius: 8px; padding: 15px; cursor: pointer; border: 2px solid transparent; transition: transform 0.2s; }
.map-card:hover { transform: translateY(-3px); }
.map-card.selected { border-color: #e94560; }
.map-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.map-card-header .map-name { font-size: 16px; font-weight: bold; color: #ffd700; }
.map-card-header .map-level { background: #e94560; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.map-card-desc { color: #aaa; font-size: 13px; margin-bottom: 8px; }
.map-card-rooms { color: #888; font-size: 11px; }
.map-detail { background: #16213e; border-radius: 8px; padding: 20px; margin-top: 20px; }
.map-detail h3 { color: #e94560; margin-bottom: 12px; }
.rooms-list { display: grid; gap: 10px; }
.room-item { background: #0f3460; border-radius: 5px; padding: 10px; }
.room-item .room-name { font-weight: bold; color: #ffd700; margin-bottom: 4px; }
.room-item .room-desc { color: #aaa; font-size: 12px; margin-bottom: 4px; }
.room-item .room-exits { color: #888; font-size: 11px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background: #16213e; border-radius: 10px; padding: 25px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; }
.info-block { background: #0f3460; padding: 8px 12px; border-radius: 5px; font-size: 13px; }
.btn { background: #e94560; color: #fff; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer; font-size: 13px; }
.btn-secondary { background: #555; }
button { background: #0f3460; color: #eee; border: 1px solid #1a4a7a; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px; }
button:hover { background: #1a4a7a; }

/* 全貌视图 */
.svg-container { background:#0a0a1a; border-radius:8px; overflow:auto; max-height:70vh; padding:8px; }
</style>
