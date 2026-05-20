// REST API integration tests — requires server running
const axios = require('axios');

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
let authToken = '';
let testUsername = '';
const results = [];

function test(name, fn) {
  // 包装异步测试
  return { name, fn };
}

async function runAll() {
  console.log('=== API Integration Tests ===\n');
  console.log(`  Target: ${API_BASE}\n`);

  let passed = 0;
  let total = 0;

  // ====== 认证测试 ======
  const authTests = [
    test('POST /auth/register — 注册新用户', async () => {
      testUsername = `testuser_${Date.now()}`;
      const res = await axios.post(`${API_BASE}/auth/register`, {
        username: testUsername,
        password: 'test123456',
        characterName: `测试侠客${Math.floor(Math.random() * 1000)}`,
        gender: 'male'
      });
      if (!res.data?.data?.token) throw new Error('No token in register response');
      authToken = res.data.data.token;
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    }),

    test('POST /auth/login — 登录', async () => {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        username: testUsername,
        password: 'test123456'
      });
      if (!res.data?.data?.token) throw new Error('No token in login response');
      authToken = res.data.data.token;
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    }),

    test('GET /user/me — 获取当前用户', async () => {
      const res = await axios.get(`${API_BASE}/user/me`);
      if (!res.data?.data?.characterName) throw new Error('No characterName in response');
      if (res.data.data.status !== 'online') throw new Error(`Expected status=online, got ${res.data.data.status}`);
    })
  ];

  for (const t of authTests) {
    total++;
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      passed++;
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      console.log(`  ✗ ${t.name}\n    → ${msg}`);
    }
  }

  // ====== 数据获取测试 ======
  if (authToken) {
    const dataTests = [
      test('GET /player/inventory — 获取背包', async () => {
        const res = await axios.get(`${API_BASE}/player/inventory`);
        if (!res.data?.data) throw new Error('No inventory data');
      }),

      test('GET /player/skills — 获取技能', async () => {
        const res = await axios.get(`${API_BASE}/player/skills`);
        if (!res.data?.data) throw new Error('No skills data');
      }),

      test('GET /player/quests — 获取任务', async () => {
        const res = await axios.get(`${API_BASE}/player/quests`);
        if (!res.data?.data) throw new Error('No quests data');
      })
    ];

    for (const t of dataTests) {
      total++;
      try {
        await t.fn();
        console.log(`  ✓ ${t.name}`);
        passed++;
      } catch (e) {
        const msg = e.response?.data?.message || e.message;
        console.log(`  ✗ ${t.name}\n    → ${msg}`);
      }
    }
  } else {
    console.log('  ⚠ Authentication failed, skipping data tests');
    total += 3;
  }

  console.log(`\n=== Results: ${passed}/${total} passed ===`);
  return { total, passed, failed: total - passed };
}

module.exports = { runAll };

if (require.main === module) {
  runAll().then(r => process.exit(r.failed > 0 ? 1 : 0)).catch(e => { console.error(e); process.exit(1); });
}
