/**
 * 迁移：无服务的 service 类型 NPC → atmosphere
 */
const fs = require('fs');
const path = require('path');

const npcs = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/json/npcs.json'), 'utf8'));

let count = 0;
for (const npc of npcs) {
  if (npc.type === 'service' && (!npc.services || npc.services.length === 0) && (!npc.quests || npc.quests.length === 0)) {
    npc.type = 'atmosphere';
    count++;
    console.log(`  ${npc.id} (${npc.name}) → atmosphere`);
  }
}

fs.writeFileSync(path.join(__dirname, '../../config/json/npcs.json'), JSON.stringify(npcs, null, 2));
console.log(`\n✅ ${count} 个 service→atmosphere`);
