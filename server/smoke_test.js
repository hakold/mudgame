const { io } = require('socket.io-client');
const http = require('http');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Login
  const loginRes = await post('http://localhost:3000/api/auth/login', {
    username: 'smoketest2',
    password: 'Test1234'
  });
  const token = loginRes.data?.token;
  if (!token) {
    console.log('LOGIN FAILED:', JSON.stringify(loginRes));
    process.exit(1);
  }
  console.log('Login OK, token:', token.substring(0, 20) + '...');

  // Connect socket
  const socket = io('http://127.0.0.1:3000', { auth: { token } });
  const events = [];

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('connect_error', (e) => console.log('Connect error:', e.message));
  socket.on('error', (d) => { events.push({ type: 'error', msg: d.message }); console.log('Error:', d.message); });

  socket.on('welcome', (d) => {
    events.push({ type: 'welcome', ok: true });
    console.log('[PASS] welcome: player=', d.player?.name, 'room=', d.room?.name);
  });

  socket.on('room_info', (d) => {
    events.push({ type: 'room_info', ok: true });
    console.log('[PASS] room_info: room=', d.name, 'exits=', d.exits?.length, 'npcs=', d.npcs?.length, 'monsters=', d.monsters?.length);
  });

  socket.on('npc_dialog', (d) => {
    events.push({ type: 'npc_dialog', ok: true });
    console.log('[PASS] npc_dialog: npc=', d.npc?.name, 'quests=', d.npc?.quests?.length);
  });

  socket.on('quest_accepted', (d) => {
    events.push({ type: 'quest_accepted', ok: true });
    console.log('[PASS] quest_accepted: quest=', d.quest?.name);
  });

  socket.on('quest_progress', (d) => {
    events.push({ type: 'quest_progress', ok: true });
    console.log('[PASS] quest_progress: quest=', d.questName, 'status=', d.status);
  });

  socket.on('battle_started', (d) => {
    events.push({ type: 'battle_started', ok: true });
    console.log('[PASS] battle_started: id=', d.battleId);
    // Attack
    setTimeout(() => {
      socket.emit('battle_action', { battleId: d.battleId, action: 'attack' });
    }, 500);
  });

  socket.on('battle_update', (d) => {
    if (d.battle?.status === 'active') {
      socket.emit('battle_action', { battleId: d.battle?.battleId, action: 'attack' });
    }
  });

  socket.on('battle_ended', (d) => {
    events.push({ type: 'battle_ended', ok: true });
    console.log('[PASS] battle_ended: status=', d.battle?.status);
  });

  socket.on('shop_items', (d) => {
    events.push({ type: 'shop_items', ok: true });
    console.log('[PASS] shop_items: count=', d.items?.length);
  });

  socket.on('item_bought', (d) => {
    events.push({ type: 'item_bought', ok: true });
    console.log('[PASS] item_bought: item=', d.item?.name);
  });

  socket.on('rest_complete', (d) => {
    events.push({ type: 'rest', ok: true });
    console.log('[PASS] rest: hp=', d.hp?.current, '/', d.hp?.max);
  });

  // Test sequence
  setTimeout(() => {
    console.log('\n--- Step: Talk NPC ---');
    socket.emit('talk_npc', { npcId: 'npc_village_chief' });
  }, 2000);

  setTimeout(() => {
    console.log('\n--- Step: Accept Quest ---');
    socket.emit('accept_quest', { questId: 'quest_talk_chief' });
  }, 3000);

  setTimeout(() => {
    console.log('\n--- Step: Move ---');
    socket.emit('move', { direction: 'east' });
  }, 4000);

  setTimeout(() => {
    console.log('\n--- Step: Battle ---');
    socket.emit('battle_start', { targetId: 'monster_wild_boar', type: 'pve' });
  }, 5500);

  setTimeout(() => {
    console.log('\n--- Step: Shop ---');
    socket.emit('shop_list');
  }, 10000);

  setTimeout(() => {
    console.log('\n--- Step: Rest ---');
    socket.emit('rest');
  }, 11000);

  // Summary
  setTimeout(() => {
    console.log('\n=== SMOKE TEST SUMMARY ===');
    const passed = events.filter(e => e.ok).length;
    const failed = events.filter(e => !e.ok).length;
    console.log(`Events received: ${events.length} (passed: ${passed}, failed: ${failed})`);
    if (events.length === 0) console.log('WARNING: No events received at all!');
    socket.disconnect();
    process.exit(0);
  }, 14000);
}

main().catch(e => { console.error(e); process.exit(1); });
