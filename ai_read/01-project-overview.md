# Project Overview

## Product Goal

Build a playable wuxia text RPG inspired by PKUXKX-style MUD gameplay, using:

- `client/`: Vue 3 + Pinia + Vite
- `server/`: Express + Socket.IO + Mongoose + Redis
- `config/json/`: content-driven maps, rooms, NPCs, monsters, items, skills, quests, factions

## Current Architecture

- HTTP API handles auth, player data queries, GM tools, and game config loading.
- Socket.IO handles room movement, chat, battle actions, NPC interaction, shop flow, rest, training, skill learning, quest progression, and faction join.
- Game content is loaded into memory from `config/json/*.json` by `server/src/game/index.js`.
- Quest objective display names are injected at startup by resolving IDs to Chinese names from corresponding configs.
- MongoDB stores users, inventory, skills, quests, battle logs, chat messages, announcements.

## Important Directories

- `client/src/views/Game.vue`: main in-game UI with contextual actions, battle interface, and interactive panels
- `client/src/stores/game.js`: client state, socket event handlers, command parser
- `server/src/socket/index.js`: main realtime gameplay event hub
- `server/src/game/battleService.js`: active battle logic, status effects, and battle settlement
- `server/src/game/questProgressService.js`: automatic quest progress tracking on gameplay events
- `server/src/models/`: persistence schemas (User, Inventory, CharacterSkill, Quest, BattleLog, ChatMessage)
- `config/json/`: content data that drives world behavior
- `server/validate_content.js`: cross-reference validation script for all config IDs
- `ai_read/`: AI collaboration notes and handoff docs

## Content Scale

| Config | Count | Notes |
|--------|-------|-------|
| Maps | 10 | village, forest, city, mountain, desert, snow, swamp, island, volcano, palace, demon, underground |
| Rooms | 36 | connected via exits, each with optional services |
| NPCs | 10 | quest_giver, shop, trainer, faction, arena, service types |
| Monsters | 22 | including 5 bosses, each with skills and drops |
| Items | 55 | consumables, weapons, armor, materials |
| Skills | 48 | attack, heal, buff, debuff, defense, passive; general + faction + monster |
| Quests | 22 | 16 main chain, 4 daily, 6 side |
| Factions | 5 | shaolin, wudang, emei, gaibang, mingjiao |

## Development Progress

Phase 1 (Stabilize Core Loop) — **DONE**
Phase 2 (Internal Consistency) — **DONE**
Phase 3 (UX Clarity) — **DONE**
Phase 4 (Expand Gameplay Depth) — **NOT STARTED**

## Key Reality Check

The project has progressed from demo-like to internally consistent. Most core systems now work end-to-end:

- Registration/login + Socket.IO connection
- Room movement with service-aware contextual actions
- PVE battle with turn system, skills, status effects, and auto-monster turns
- Shop buy/sell with room-type filtering
- Equipment purchase and equip via inventory panel
- Rest in supported rooms
- Stat training with Chinese/English input support
- Skill learning with faction and level checks
- Quest progress auto-advances on kill, visit, talk, learn_skill, join_faction, buy, train events
- Quest completion with reward claiming
- Faction join
- All config cross-references validated (zero errors)

Still not fully implemented:

- Passive skill effects (mpRegen, persistent buffs) not processed per battle turn
- Counter-attack mechanic defined but not consumed
- `collect` quest objective type has no trigger (no loot/pickup system)
- PVP not tested end-to-end
- NPC-specific services not surfaced as room actions in UI