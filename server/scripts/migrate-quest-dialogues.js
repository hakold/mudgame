/**
 * 迁移脚本：对话-任务解耦
 * 1. NPC quest_* 对话 → 对应 quest.dialogue
 * 2. 清理 NPC 的 quest_* 键
 * 3. quests.json 移除 npcId
 */
const fs = require('fs');
const path = require('path');

const npcs = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/json/npcs.json'), 'utf8'));
const quests = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/json/quests.json'), 'utf8'));

const QUEST_DIALOGUE_KEYS = ['quest_available', 'quest_accepted', 'quest_completed', 'quest_list'];
let migratedCount = 0;
let cleanedNpcCount = 0;

// 1. 迁移 NPC quest_* 对话到 quest.dialogue
for (const npc of npcs) {
  const d = npc.dialogues || {};
  const questIds = npc.quests || [];
  let hasQuestDialogue = false;

  for (const questId of questIds) {
    const quest = quests.find(q => q.id === questId);
    if (!quest) continue;
    quest.dialogue = quest.dialogue || {};

    for (const key of QUEST_DIALOGUE_KEYS) {
      if (d[key]) {
        const targetKey = key.replace('quest_', '');
        if (!quest.dialogue[targetKey]) {
          quest.dialogue[targetKey] = d[key];
          migratedCount++;
        }
        hasQuestDialogue = true;
      }
    }
  }

  // 2. 清理 NPC 的 quest_* 键
  if (hasQuestDialogue) {
    npc.dialogues = Object.fromEntries(
      Object.entries(d).filter(([k]) => !QUEST_DIALOGUE_KEYS.includes(k))
    );
    cleanedNpcCount++;
  }
}

// 3. 移除 quests 的 npcId
let removedNpcId = 0;
for (const q of quests) {
  if (q.npcId !== undefined) {
    delete q.npcId;
    removedNpcId++;
  }
}

// 备份 + 写入
const bakDir = path.join(__dirname, '../../backups', `migrate_${Date.now()}`);
fs.mkdirSync(bakDir, { recursive: true });
fs.writeFileSync(path.join(bakDir, 'npcs.json'), JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/json/npcs.json'), 'utf8')), null, 2));
fs.writeFileSync(path.join(bakDir, 'quests.json'), JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/json/quests.json'), 'utf8')), null, 2));

fs.writeFileSync(path.join(__dirname, '../../config/json/npcs.json'), JSON.stringify(npcs, null, 2));
fs.writeFileSync(path.join(__dirname, '../../config/json/quests.json'), JSON.stringify(quests, null, 2));

console.log(`✅ 迁移完成`);
console.log(`   对话迁移: ${migratedCount} 条`);
console.log(`   NPC清理: ${cleanedNpcCount} 个`);
console.log(`   移除npcId: ${removedNpcId} 个`);
console.log(`   备份: ${bakDir}`);
