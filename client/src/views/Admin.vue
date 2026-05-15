<template>
  <div class="admin-container">
    <!-- 侧边栏 -->
    <div class="admin-sidebar">
      <h3 style="color: #e94560; margin-bottom: 20px;">管理后台</h3>
      
      <div 
        class="admin-menu-item" 
        :class="{ active: activeMenu === 'players' }"
        @click="activeMenu = 'players'"
      >
        玩家管理
      </div>
      <div 
        class="admin-menu-item" 
        :class="{ active: activeMenu === 'announcements' }"
        @click="activeMenu = 'announcements'"
      >
        公告管理
      </div>
      <div 
        class="admin-menu-item" 
        :class="{ active: activeMenu === 'statistics' }"
        @click="activeMenu = 'statistics'"
      >
        数据统计
      </div>
      <div 
        class="admin-menu-item" 
        :class="{ active: activeMenu === 'logs' }"
        @click="activeMenu = 'logs'"
      >
        战斗日志
      </div>
      <div 
        class="admin-menu-item" 
        :class="{ active: activeMenu === 'maps' }"
        @click="activeMenu = 'maps'; loadMaps()"
      >
        地图管理
      </div>
      
      <div style="margin-top: 20px;">
        <button class="btn btn-secondary" @click="goBack">返回游戏</button>
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="admin-content">
      <!-- 玩家管理 -->
      <div v-if="activeMenu === 'players'">
        <div class="admin-header">
          <h2 class="admin-title">玩家管理</h2>
          <div>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="搜索玩家..." 
              style="padding: 8px; margin-right: 10px;"
            />
            <button class="btn" style="width: auto; padding: 8px 15px;" @click="searchPlayers">搜索</button>
          </div>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>角色名</th>
              <th>等级</th>
              <th>门派</th>
              <th>状态</th>
              <th>金币</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="player in players" :key="player._id">
              <td>{{ player.characterName }}</td>
              <td>{{ player.level }}</td>
              <td>{{ player.faction || '无' }}</td>
              <td>{{ player.status }}</td>
              <td>{{ player.gold }}</td>
              <td>{{ formatDate(player.createdAt) }}</td>
              <td>
                <button @click="showPlayerDetail(player)" style="margin-right: 5px;">详情</button>
                <button @click="giveGold(player._id)" style="margin-right: 5px;">发金币</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- 公告管理 -->
      <div v-if="activeMenu === 'announcements'">
        <div class="admin-header">
          <h2 class="admin-title">公告管理</h2>
          <button class="btn" style="width: auto; padding: 8px 15px;" @click="showCreateAnnouncement = true">发布公告</button>
        </div>
        
        <div v-if="showCreateAnnouncement" style="background: #16213e; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <div class="form-group">
            <label>标题</label>
            <input v-model="newAnnouncement.title" type="text" />
          </div>
          <div class="form-group">
            <label>内容</label>
            <textarea v-model="newAnnouncement.content" rows="5" style="width: 100%; padding: 10px; background: #1a1a2e; color: #eee; border: 1px solid #0f3460; border-radius: 5px;"></textarea>
          </div>
          <div class="form-group">
            <label>类型</label>
            <select v-model="newAnnouncement.type">
              <option value="normal">普通</option>
              <option value="important">重要</option>
              <option value="urgent">紧急</option>
              <option value="event">活动</option>
            </select>
          </div>
          <button class="btn" @click="createAnnouncement">发布</button>
          <button class="btn btn-secondary" @click="showCreateAnnouncement = false" style="margin-left: 10px;">取消</button>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>类型</th>
              <th>发布者</th>
              <th>发布时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="announcement in announcements" :key="announcement._id">
              <td>{{ announcement.title }}</td>
              <td>{{ announcement.type }}</td>
              <td>{{ announcement.authorName }}</td>
              <td>{{ formatDate(announcement.createdAt) }}</td>
              <td>
                <button @click="deleteAnnouncement(announcement._id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- 数据统计 -->
      <div v-if="activeMenu === 'statistics'">
        <div class="admin-header">
          <h2 class="admin-title">数据统计</h2>
        </div>
        
        <div style="display: flex; gap: 20px; margin-bottom: 20px;">
          <div style="background: #16213e; padding: 20px; border-radius: 5px; flex: 1; text-align: center;">
            <div style="color: #aaa; margin-bottom: 10px;">总玩家数</div>
            <div style="font-size: 32px; color: #e94560;">{{ statistics.totalPlayers }}</div>
          </div>
          <div style="background: #16213e; padding: 20px; border-radius: 5px; flex: 1; text-align: center;">
            <div style="color: #aaa; margin-bottom: 10px;">在线玩家</div>
            <div style="font-size: 32px; color: #4fc3f7;">{{ statistics.onlinePlayers }}</div>
          </div>
          <div style="background: #16213e; padding: 20px; border-radius: 5px; flex: 1; text-align: center;">
            <div style="color: #aaa; margin-bottom: 10px;">今日新增</div>
            <div style="font-size: 32px; color: #ffd700;">{{ statistics.newPlayersToday }}</div>
          </div>
        </div>
      </div>
      
      <!-- 战斗日志 -->
      <div v-if="activeMenu === 'logs'">
        <div class="admin-header">
          <h2 class="admin-title">战斗日志</h2>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>战斗ID</th>
              <th>类型</th>
              <th>参与者</th>
              <th>胜利者</th>
              <th>回合数</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in battleLogs" :key="log._id">
              <td>{{ log.battleId?.substring(0, 8) }}</td>
              <td>{{ log.type }}</td>
              <td>{{ log.participants?.map(p => p.name).join(', ') }}</td>
              <td>{{ log.result?.winner }}</td>
              <td>{{ log.rounds?.length }}</td>
              <td>{{ formatDate(log.startedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- 地图管理 -->
      <div v-if="activeMenu === 'maps'">
        <div class="admin-header">
          <h2 class="admin-title">地图管理</h2>
        </div>
        
        <div class="maps-grid">
          <div v-for="map in maps" :key="map.id" class="map-card" @click="selectedMap = map">
            <div class="map-card-header">
              <span class="map-name">{{ map.name }}</span>
              <span class="map-level">{{ map.level }}</span>
            </div>
            <div class="map-card-desc">{{ map.description }}</div>
            <div class="map-card-rooms">房间数: {{ getRoomsForMap(map.id).length }}</div>
          </div>
        </div>
        
        <div v-if="selectedMap" class="map-detail">
          <h3>{{ selectedMap.name }} - 房间列表</h3>
          <div class="rooms-list">
            <div v-for="room in getRoomsForMap(selectedMap.id)" :key="room.id" class="room-item">
              <div class="room-name">{{ room.name }}</div>
              <div class="room-desc">{{ room.description }}</div>
              <div class="room-exits">
                出口: {{ room.exits?.map(e => e.direction + '→' + e.roomId).join(', ') || '无' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import axios from 'axios'

const router = useRouter()
const gameStore = useGameStore()

const activeMenu = ref('players')
const searchQuery = ref('')
const players = ref([])
const announcements = ref([])
const statistics = ref({
  totalPlayers: 0,
  onlinePlayers: 0,
  newPlayersToday: 0
})
const battleLogs = ref([])
const maps = ref([])
const rooms = ref([])
const selectedMap = ref(null)

const showCreateAnnouncement = ref(false)
const newAnnouncement = ref({
  title: '',
  content: '',
  type: 'normal'
})

function formatDate(date) {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN')
}

function goBack() {
  router.push('/game')
}

async function loadPlayers() {
  try {
    const response = await axios.get('/gm/players')
    players.value = response.data.data.players
  } catch (error) {
    console.error('加载玩家列表失败:', error)
  }
}

async function searchPlayers() {
  try {
    const response = await axios.get('/gm/players', {
      params: { search: searchQuery.value }
    })
    players.value = response.data.data.players
  } catch (error) {
    console.error('搜索失败:', error)
  }
}

function showPlayerDetail(player) {
  alert(`角色名: ${player.characterName}\n等级: ${player.level}\nHP: ${player.hp?.current}/${player.hp?.max}\nMP: ${player.mp?.current}/${player.mp?.max}\n金币: ${player.gold}`)
}

async function giveGold(playerId) {
  const amount = prompt('请输入金币数量:')
  if (!amount) return
  
  try {
    await axios.post(`/gm/players/${playerId}/gold`, { amount: parseInt(amount) })
    alert('发放成功')
    loadPlayers()
  } catch (error) {
    alert('发放失败: ' + error.response?.data?.message)
  }
}

async function loadAnnouncements() {
  try {
    const response = await axios.get('/announcements')
    announcements.value = response.data.data
  } catch (error) {
    console.error('加载公告失败:', error)
  }
}

async function createAnnouncement() {
  try {
    await axios.post('/gm/announcements', newAnnouncement.value)
    showCreateAnnouncement.value = false
    newAnnouncement.value = { title: '', content: '', type: 'normal' }
    loadAnnouncements()
    alert('发布成功')
  } catch (error) {
    alert('发布失败: ' + error.response?.data?.message)
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('确定要删除这条公告吗？')) return
  
  try {
    await axios.delete(`/gm/announcements/${id}`)
    loadAnnouncements()
  } catch (error) {
    alert('删除失败')
  }
}

async function loadStatistics() {
  try {
    const response = await axios.get('/gm/statistics')
    statistics.value = response.data.data
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

async function loadBattleLogs() {
  try {
    const response = await axios.get('/gm/battle-logs')
    battleLogs.value = response.data.data.logs
  } catch (error) {
    console.error('加载战斗日志失败:', error)
  }
}

async function loadMaps() {
  try {
    const response = await axios.get('/game/config')
    const config = response.data.data
    maps.value = Object.values(config.maps || {})
    rooms.value = Object.values(config.rooms || {})
  } catch (error) {
    console.error('加载地图失败:', error)
  }
}

function getRoomsForMap(mapId) {
  return rooms.value.filter(r => r.mapId === mapId)
}

onMounted(() => {
  loadPlayers()
  loadAnnouncements()
  loadStatistics()
  loadBattleLogs()
})
</script>

<style scoped>
.admin-container {
  display: flex;
  min-height: 100vh;
  background: #0f0f23;
  color: #eee;
}

.admin-sidebar {
  width: 200px;
  background: #16213e;
  padding: 20px;
  border-right: 1px solid #1a1a40;
}

.admin-menu-item {
  padding: 12px 15px;
  margin-bottom: 5px;
  cursor: pointer;
  border-radius: 5px;
  transition: background 0.2s;
}

.admin-menu-item:hover {
  background: #1a4a7a;
}

.admin-menu-item.active {
  background: #e94560;
}

.admin-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.admin-title {
  color: #e94560;
  margin: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #16213e;
  border-radius: 5px;
  overflow: hidden;
}

.data-table th,
.data-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #1a1a40;
}

.data-table th {
  background: #0f3460;
  color: #e94560;
}

.data-table tr:hover {
  background: #1a4a7a;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #aaa;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px;
  background: #0f3460;
  border: 1px solid #1a4a7a;
  border-radius: 5px;
  color: #eee;
}

.maps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.map-card {
  background: #16213e;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
}

.map-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.map-card.selected {
  border-color: #e94560;
}

.map-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.map-card-header .map-name {
  font-size: 18px;
  font-weight: bold;
  color: #ffd700;
}

.map-card-header .map-level {
  background: #e94560;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.map-card-desc {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 10px;
}

.map-card-rooms {
  color: #888;
  font-size: 12px;
}

.map-detail {
  background: #16213e;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.map-detail h3 {
  color: #e94560;
  margin-bottom: 15px;
}

.rooms-list {
  display: grid;
  gap: 10px;
}

.room-item {
  background: #0f3460;
  border-radius: 5px;
  padding: 12px;
}

.room-item .room-name {
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 5px;
}

.room-item .room-desc {
  color: #aaa;
  font-size: 13px;
  margin-bottom: 5px;
}

.room-item .room-exits {
  color: #888;
  font-size: 12px;
}
</style>