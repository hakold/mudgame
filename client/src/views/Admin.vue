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
      <div class="admin-menu-item" :class="{ active: activeMenu === 'announcements' }" @click="loadAnnouncements()">📢 公告管理</div>
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
          <button class="btn" style="width:auto; padding:6px 12px;" @click="loadActionLogs()">查询</button>
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
        <button class="btn" style="width:auto; padding:8px 15px; margin-bottom:10px;" @click="editingQuest = {}; showQuestEditor = true;">+ 新建任务</button>
        <table class="data-table">
          <thead><tr><th>ID</th><th>名称</th><th>类型</th><th>目标</th><th>奖励</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="q in questConfigs" :key="q.id">
              <td>{{ q.id }}</td><td>{{ q.name }}</td><td>{{ q.type }}</td>
              <td style="font-size:12px;">{{ q.objectives?.map(o => o.type + ':' + (o.npcId || o.monsterId || '')).join(', ') }}</td>
              <td style="font-size:12px;">exp:{{ q.rewards?.exp }} gold:{{ q.rewards?.gold }}</td>
              <td>
                <button @click="editingQuest = JSON.parse(JSON.stringify(q)); showQuestEditor = true;" style="margin-right:3px;">编辑</button>
                <button @click="deleteQuestConfig(q.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <!-- 任务编辑弹窗 -->
        <div v-if="showQuestEditor" class="modal-overlay" @click.self="showQuestEditor = false">
          <div class="modal-content" style="max-width:600px;">
            <h3>{{ editingQuest.id ? '编辑任务' : '新建任务' }}</h3>
            <div class="form-group"><label>ID</label><input v-model="editingQuest.id" :disabled="!!questConfigs.find(q=>q.id===editingQuest.id && editingQuest._editing)" /></div>
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

      <!-- ====== 地图管理（增强） ====== -->
      <div v-if="activeMenu === 'maps'">
        <h2 class="admin-title">地图管理</h2>
        <div class="maps-grid">
          <div v-for="map in maps" :key="map.id" class="map-card" :class="{ selected: selectedMap?.id === map.id }" @click="selectedMap = map; loadRoomsForMap(map.id)">
            <div class="map-card-header"><span class="map-name">{{ map.name }}</span><span class="map-level">{{ map.level }}</span></div>
            <div class="map-card-desc">{{ map.description }}</div>
            <div class="map-card-rooms">房间数: {{ map.roomCount || 0 }}</div>
          </div>
        </div>
        <div v-if="selectedMap" class="map-detail">
          <h3>{{ selectedMap.name }} - 房间列表</h3>
          <div class="rooms-list">
            <div v-for="room in mapRooms" :key="room.id" class="room-item">
              <div class="room-name">{{ room.name }} <span style="color:#888; font-size:11px;">({{ room.id }})</span></div>
              <div class="room-desc">{{ room.description }}</div>
              <div class="room-exits">出口: {{ room.exits?.map(e => e.direction + '→' + e.roomId).join(', ') || '无' }} | 服务: {{ (room.services || []).join(', ') || '无' }}</div>
              <div style="margin-top:5px;"><button @click="editRoom(room)" style="font-size:11px;">编辑</button></div>
            </div>
          </div>
        </div>
        <!-- 房间编辑弹窗 -->
        <div v-if="showRoomEditor" class="modal-overlay" @click.self="showRoomEditor = false">
          <div class="modal-content" style="max-width:500px;">
            <h3>编辑房间: {{ editingRoom.id }}</h3>
            <div class="form-group"><label>名称</label><input v-model="editingRoom.name" /></div>
            <div class="form-group"><label>描述</label><textarea v-model="editingRoom.description" rows="2"></textarea></div>
            <div class="form-group"><label>服务 (逗号分隔)</label><input v-model="editingRoom.servicesStr" /></div>
            <div class="form-group"><label>出口 (JSON)</label><textarea v-model="editingRoom.exitsStr" rows="3" placeholder='[{"direction":"north","roomId":"forest_path"}]'></textarea></div>
            <button class="btn" @click="saveRoom">保存</button>
            <button class="btn btn-secondary" @click="showRoomEditor = false" style="margin-left:10px;">取消</button>
          </div>
        </div>
      </div>

      <!-- ====== 公告管理 ====== -->
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
import { ref, onMounted } from 'vue'
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
    case 'reset': if (!confirm('确定重置该玩家？(回村/满血/状态online)')) return; break
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
const questConfigs = ref([]), showQuestEditor = ref(false), editingQuest = ref({})
async function loadQuestConfigs() { try { questConfigs.value = (await axios.get('/gm/config/quests')).data.data } catch(e) {} }
async function saveQuestConfig() {
  const q = editingQuest.value
  try {
    if (q.objectivesStr) q.objectives = JSON.parse(q.objectivesStr)
    if (q.rewardsStr) q.rewards = JSON.parse(q.rewardsStr)
    if (questConfigs.value.find(x => x.id === q.id)) { await axios.put(`/gm/config/quests/${q.id}`, q) }
    else { await axios.post('/gm/config/quests', q) }
    showQuestEditor.value = false; loadQuestConfigs()
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

// 地图
const maps = ref([]), mapRooms = ref([]), selectedMap = ref(null), showRoomEditor = ref(false), editingRoom = ref({})
async function loadMaps() { try { maps.value = (await axios.get('/gm/config/maps')).data.data } catch(e) {} }
async function loadRoomsForMap(mapId) { try { mapRooms.value = (await axios.get('/gm/config/rooms', { params: { mapId } })).data.data } catch(e) {} }
function editRoom(room) { editingRoom.value = JSON.parse(JSON.stringify(room)); editingRoom.value.servicesStr = (room.services || []).join(','); editingRoom.value.exitsStr = JSON.stringify(room.exits || []); showRoomEditor.value = true }
async function saveRoom() {
  const r = editingRoom.value
  try {
    r.services = r.servicesStr ? r.servicesStr.split(',').map(s => s.trim()).filter(Boolean) : []
    r.exits = JSON.parse(r.exitsStr || '[]')
    await axios.put(`/gm/config/rooms/${r.id}`, r)
    showRoomEditor.value = false; loadRoomsForMap(selectedMap.value.id); loadMaps()
  } catch(e) { alert('保存失败: ' + (e.response?.data?.message || e.message)) }
}

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
</style>
