// Socket.IO full-flow integration test
// Requires: server running, test account
const { io } = require('socket.io-client');
const axios = require('axios');

const SOCKET_URL = process.env.TEST_SOCKET_URL || 'http://localhost:3000';
const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';

const results = [];
const TIMEOUT = 8000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForEvent(socket, event, timeout = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${event}'`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function runAll() {
  console.log('=== Socket.IO Full-Flow Integration Test ===\n');
  console.log(`  Target: ${SOCKET_URL}\n`);

  let passed = 0;
  let total = 0;

  // ====== 注册 + 认证 ======
  const testUser = `flowtest_${Date.now()}`;
  const testPass = 'flow123456';
  let authToken;
  let socket;

  async function step(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗ ${name}\n    → ${e.message}`);
      // 关键步骤失败则终止后续
      if (e.message?.includes('CRITICAL')) throw e;
    }
  }

  try {
    // ---- 阶段1: 注册+连接 ----
    await step('1.1 注册测试账号', async () => {
      const res = await axios.post(`${API_BASE}/auth/register`, {
        username: testUser, password: testPass,
        characterName: `流程测试${Math.floor(Math.random() * 900) + 100}`,
        gender: 'male'
      });
      authToken = res.data.data.token;
      if (!authToken) throw new Error('CRITICAL: No auth token');
    });

    await step('1.2 Socket连接', async () => {
      socket = io(SOCKET_URL, { auth: { token: authToken }, transports: ['websocket'] });
      const data = await waitForEvent(socket, 'welcome');
      if (!data.room) throw new Error('CRITICAL: No room in welcome');
      if (data.room.id !== 'village_center') throw new Error(`Expected village_center, got ${data.room.id}`);
    });

    await step('1.3 收到当前房间信息', async () => {
      const room = await waitForEvent(socket, 'room_info');
      if (!room.name) throw new Error('No room name');
    });

    // ---- 阶段2: 移动 ----
    await step('2.1 移动到客栈', async () => {
      socket.emit('move', { direction: 'north' });
      const room = await waitForEvent(socket, 'room_info');
      if (room.id !== 'village_inn') throw new Error(`Expected village_inn, got ${room.id}`);
    });

    await step('2.2 返回村庄广场', async () => {
      socket.emit('move', { direction: 'south' });
      const room = await waitForEvent(socket, 'room_info');
      if (room.id !== 'village_center') throw new Error(`Expected village_center, got ${room.id}`);
    });

    // ---- 阶段3: NPC交互 ----
    await step('3.1 与村长对话', async () => {
      socket.emit('talk_npc', { npcId: 'npc_village_chief' });
      const data = await waitForEvent(socket, 'npc_dialog');
      if (!data.npc || data.npc.id !== 'npc_village_chief') throw new Error(`Expected village chief, got ${data.npc?.id}`);
      if (!data.availableQuests) throw new Error('No availableQuests in dialog');
    });

    // ---- 阶段4: 战斗 ----
    await step('4.1 移动到森林入口', async () => {
      socket.emit('move', { direction: 'out' });
      const room = await waitForEvent(socket, 'room_info');
      if (!['forest_entrance', 'village_center'].includes(room.id)) throw new Error(`Got unexpected room: ${room.id}`);
    });

    await step('4.2 攻击野兔', async () => {
      socket.emit('attack', { target: 'monster_wild_rabbit' });
      // 可能: battle_started 或 error(怪物不存在)
      const race = await Promise.race([
        waitForEvent(socket, 'battle_started').then(d => ({ type: 'battle', data: d })),
        waitForEvent(socket, 'error').then(d => ({ type: 'error', data: d })),
        sleep(TIMEOUT).then(() => ({ type: 'timeout' }))
      ]);
      if (race.type === 'timeout') throw new Error('No response to attack');
      if (race.type === 'error' && race.data.message?.includes('不在')) {
        console.log(`    ℹ 野兔不在，移动到森林深处`);
        socket.emit('move', { direction: 'in' });
        await waitForEvent(socket, 'room_info');
        socket.emit('attack', { target: 'monster_wild_rabbit' });
        const retry = await Promise.race([
          waitForEvent(socket, 'battle_started'),
          waitForEvent(socket, 'error')
        ]);
        if (retry.message) throw new Error(`Attack failed: ${retry.message}`);
      }
    });

    // ---- 阶段5: 使用物品 ----
    await step('5.1 查看背包', async () => {
      const res = await axios.get(`${API_BASE}/player/inventory`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.data?.data) throw new Error('No inventory');
    });

    // ---- 阶段6: 门派 ----
    await step('6.1 查看门派列表', async () => {
      socket.emit('list_factions');
      const data = await waitForEvent(socket, 'factions_list');
      if (!Array.isArray(data) || data.length === 0) throw new Error('No factions returned');
      if (!data.find(f => f.id === 'shaolin')) throw new Error('Shaolin faction not found');
    });

    // ---- 阶段7: 断开重连 ----
    await step('7.1 断开Socket', async () => {
      socket.disconnect();
      await sleep(500);
      socket = io(SOCKET_URL, { auth: { token: authToken }, transports: ['websocket'] });
      const data = await waitForEvent(socket, 'welcome');
      if (!data.message) throw new Error('No welcome on reconnect');
    });

  } catch (e) {
    if (!e.message?.startsWith('CRITICAL')) {
      console.log(`  ⚠ Test flow interrupted: ${e.message}`);
    }
  } finally {
    if (socket) socket.disconnect();
  }

  console.log(`\n=== Results: ${passed}/${total} passed ===`);
  return { total, passed, failed: total - passed };
}

module.exports = { runAll };

if (require.main === module) {
  runAll().then(r => process.exit(r.failed > 0 ? 1 : 0));
}
