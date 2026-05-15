const fs = require('fs');
const path = require('path');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../config/json', `${name}.json`), 'utf-8'));
}

const items = loadJson('items');
const skills = loadJson('skills');
const monsters = loadJson('monsters');
const quests = loadJson('quests');
const rooms = loadJson('rooms');
const npcs = loadJson('npcs');
const factions = loadJson('factions');

const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
const skillMap = Object.fromEntries(skills.map(s => [s.id, s]));
const monsterMap = Object.fromEntries(monsters.map(m => [m.id, m]));
const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));
const npcMap = Object.fromEntries(npcs.map(n => [n.id, n]));
const factionMap = Object.fromEntries(factions.map(f => [f.id, f]));

let errors = 0;

function check(context, id, map, label) {
  if (!map[id]) {
    console.log(`  [MISSING] ${context}: ${label} "${id}" not found`);
    errors++;
  }
}

// Monster drops → items
console.log('=== Monster Drop Items ===');
for (const m of monsters) {
  for (const drop of m.drops || []) {
    check(`monster ${m.id}`, drop.itemId, itemMap, 'item');
  }
}

// Monster skills → skills
console.log('=== Monster Skills ===');
for (const m of monsters) {
  for (const skillId of m.skills || []) {
    check(`monster ${m.id}`, skillId, skillMap, 'skill');
  }
}

// Quest rewards.items → items
console.log('=== Quest Reward Items ===');
for (const q of quests) {
  for (const itemId of q.rewards?.items || []) {
    check(`quest ${q.id}`, itemId, itemMap, 'item');
  }
}

// Quest objectives → targets
console.log('=== Quest Objective Targets ===');
for (const q of quests) {
  for (const obj of q.objectives || []) {
    if (obj.monsterId && obj.monsterId !== 'any') check(`quest ${q.id}`, obj.monsterId, monsterMap, 'monster');
    if (obj.npcId) check(`quest ${q.id}`, obj.npcId, npcMap, 'npc');
    if (obj.roomId && obj.roomId !== 'any') check(`quest ${q.id}`, obj.roomId, roomMap, 'room');
    if (obj.itemId) check(`quest ${q.id}`, obj.itemId, itemMap, 'item');
  }
}

// Quest prerequisites → other quests
console.log('=== Quest Prerequisites ===');
const questMap = Object.fromEntries(quests.map(q => [q.id, q]));
for (const q of quests) {
  for (const prereq of q.prerequisites || []) {
    check(`quest ${q.id}`, prereq, questMap, 'quest');
  }
}

// Quest roomId → rooms
console.log('=== Quest Room IDs ===');
for (const q of quests) {
  if (q.roomId) check(`quest ${q.id}`, q.roomId, roomMap, 'room');
}

// Quest npcId → npcs
console.log('=== Quest NPC IDs ===');
for (const q of quests) {
  if (q.npcId) check(`quest ${q.id}`, q.npcId, npcMap, 'npc');
}

// NPC roomId → rooms
console.log('=== NPC Room IDs ===');
for (const n of npcs) {
  if (n.roomId) check(`npc ${n.id}`, n.roomId, roomMap, 'room');
}

// Monster roomId → rooms
console.log('=== Monster Room IDs ===');
for (const m of monsters) {
  if (m.roomId) check(`monster ${m.id}`, m.roomId, roomMap, 'room');
}

// Room exits → rooms
console.log('=== Room Exit References ===');
for (const r of rooms) {
  for (const exit of r.exits || []) {
    check(`room ${r.id}`, exit.roomId, roomMap, 'room');
  }
}

// Item schema consistency
console.log('=== Item Schema Consistency ===');
for (const item of items) {
  if (item.type === 'weapon' || item.type === 'armor') {
    if (!item.stats && !item.attributes) {
      console.log(`  [WARN] item ${item.id}: equipment without stats or attributes`);
      errors++;
    }
    if (!item.subtype) {
      console.log(`  [WARN] item ${item.id}: equipment without subtype (slot routing may default)`);
    }
  }
  if (item.type === 'consumable') {
    if (!item.effects) {
      console.log(`  [WARN] item ${item.id}: consumable without effects array`);
      errors++;
    }
  }
}

// Skill schema consistency
console.log('=== Skill Schema Consistency ===');
for (const skill of skills) {
  if (skill.type === 'passive' && skill.buff && !skill.buff.duration) {
    console.log(`  [WARN] skill ${skill.id}: passive buff without duration`);
    errors++;
  }
}

console.log(`\n=== Result: ${errors === 0 ? 'ALL OK' : `${errors} issue(s) found`} ===`);
process.exit(errors > 0 ? 1 : 0);
