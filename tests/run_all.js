#!/usr/bin/env node
// 主测试运行器 — 按需运行各测试模块

const args = process.argv.slice(2);
const runConfig = args.includes('--config') || args.length === 0;
const runGame = args.includes('--game') || args.length === 0;
const runApi = args.includes('--api') || args.includes('--full');
const runSocket = args.includes('--socket') || args.includes('--full');
const runAll = args.includes('--full');

if (runAll) console.log('🚀 全流程测试 (--full)\n');

const suiteResults = [];

async function main() {
  // 阶段1: 配置验证 (始终运行，无需服务器)
  if (runConfig) {
    console.log('═══════════════════════════════════');
    console.log('  阶段1: 配置数据验证 (无服务器)');
    console.log('═══════════════════════════════════\n');
    const config = require('./config.test');
    const r = config.runAll();
    suiteResults.push({ name: 'Config Validation', ...r });
    if (r.failed > 0) {
      console.log('❌ 配置验证有错误，请先修复再继续。');
      if (!runAll) process.exit(1);
    }
  }

  // 阶段2: 游戏逻辑测试
  if (runGame) {
    console.log('\n═══════════════════════════════════');
    console.log('  阶段2: 游戏逻辑单元测试');
    console.log('═══════════════════════════════════\n');
    const game = require('./game.test');
    const r = game.runAll();
    suiteResults.push({ name: 'Game Logic', ...r });
  }

  // 阶段3: API 测试 (需要服务器)
  if (runApi || runSocket) {
    const axios = require('axios');
    try {
      await axios.get('http://localhost:3000/api/health', { timeout: 3000 });
    } catch (e) {
      console.log('\n⚠  服务器未运行，跳过API/Socket测试。');
      console.log('   请先启动服务器: cd server && npm start');
      if (runAll) process.exit(0);
      return;
    }
  }

  if (runApi) {
    console.log('\n═══════════════════════════════════');
    console.log('  阶段3: REST API 集成测试');
    console.log('═══════════════════════════════════\n');
    const api = require('./api.test');
    const r = await api.runAll();
    suiteResults.push({ name: 'API Integration', ...r });
  }

  // 阶段4: Socket 全流程测试
  if (runSocket) {
    console.log('\n═══════════════════════════════════');
    console.log('  阶段4: Socket.IO 全流程测试');
    console.log('═══════════════════════════════════\n');
    const sock = require('./socket.test');
    const r = await sock.runAll();
    suiteResults.push({ name: 'Socket Flow', ...r });
  }

  // 汇总
  console.log('\n═══════════════════════════════════');
  console.log('  测试汇总');
  console.log('═══════════════════════════════════');
  let totalPass = 0, totalAll = 0;
  for (const s of suiteResults) {
    const status = s.failed === 0 ? '✅' : '❌';
    console.log(`  ${status} ${s.name}: ${s.passed}/${s.total} passed`);
    totalPass += s.passed;
    totalAll += s.total;
  }
  console.log(`\n  Total: ${totalPass}/${totalAll} passed`);

  if (suiteResults.some(s => s.failed > 0)) {
    console.log('\n❌ 存在未通过的测试，请修复后重新运行。');
    process.exit(1);
  } else {
    console.log('\n✅ 全部测试通过！');
  }
}

main().catch(e => {
  console.error('Test runner error:', e.message);
  process.exit(1);
});
