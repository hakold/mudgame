# Current State

## What Was Recently Completed (2026-05-15 Phase 4)

Phase 4 — Expand Wuxia Gameplay Depth — is now substantially complete:

### Batch 1: Core Combat Mechanics
- **Passive skill processing**: `mpRegen` per turn and persistent `buff` effects (易筋经 constitution +10) now apply in battle via `applyPassiveSkills()` and `processStartOfTurnEffects()`. Tested: 冥想 restores 5 MP per turn, 易筋经 adds constitution modifier.
- **Counter-attack mechanic**: `counterChance` on any skill (including attack-type like 太极拳) now triggers counter damage via `applyCounterAttack()`. Counter damage = 30% of incoming damage. Tested: counter deals 9 damage from 30 incoming.
- **Loot/pickup system**: New `roomDropsService.js` manages ground items per room. Monsters drop items to room floor instead of directly into inventory. Players use `pickup_item` socket event to collect. Stacking, expiry cleanup, and room broadcasts all work.
- **Collect quest trigger**: `pickup_item` event triggers `questProgressService.checkProgress(userId, { type: 'collect', target: itemId })`. `itemId === 'any'` wildcard also supported.
- **Bug fixes**: NPC trainer skill IDs corrected (`basic_attack` → `skill_basic_attack`, etc.). `questConfig.reward` → `questConfig.rewards` and `skill_heal` → `skill_heal_basic` were already fixed in Phase 2.

### Batch 2: Faction Progression & Death
- **Faction advancement**: User model now has `factionReputation`, `factionContribution`, `factionRank` (disciple→deacon→elder→leader). Advancement requires reputation + level thresholds. `faction_advance` socket event. `faction_task` event for donating gold to earn reputation. Rank unlocks higher-tier faction skills via `rankRequired` field.
- **Skill experience**: Battle end now grants skill EXP for skills used during combat. `CharacterSkill.levelUp()` already existed; now `endBattle()` computes and awards skill EXP based on monster level. Skill level-up notifications included in battle result.
- **Death penalty**: `applyDeathPenalty()` — 10% EXP loss, 5% gold loss. Death also causes extra equipment durability loss (10 points per equipped item).
- **Revive**: `revive` socket event restores player to 30% HP/MP, teleports to `village_center`, sets status to `online`.

### Batch 3: UI & Equipment Systems
- **Battle log visualization**: `get_battle_logs` and `get_battle_detail` socket events query `BattleLog` model. Pagination support (limit/offset).
- **Attribute point allocation**: `allocate_points` socket event lets players spend `freePoints` on any stat without gold/exp cost. Each level-up grants 3 free points, faction advancement grants 5.
- **Equipment durability**: Inventory model already had durability fields. Now battle end consumes 1-3 durability per equipped item; death consumes 10 extra. `repair_item` and `repair_all` socket events at blacksmith rooms (1 gold per durability point).

### Env Configuration
- Server `.env.example` created with all configurable fields (PORT, HOST, MongoDB, Redis, JWT, CORS).
- Client `.env.example` created with `VITE_API_URL` and `VITE_SOCKET_URL`.
- `.gitignore` already excludes `.env` files.

## What Works Reasonably Well Right Now

- User can log in and connect to Socket.IO.
- Room descriptions, exits, NPCs, and monsters are visible.
- Player can move between rooms through socket events.
- Basic shop listing and purchase flow works in supported rooms.
- Equipment can be bought in valid rooms and equipped via inventory panel.
- Basic PVE battle can start and resolve without crashes.
- Battle UI shows HP bars, turn indicator, status effects, and skill buttons.
- Quest progress auto-updates on gameplay events with composite keys.
- Right-side panels show live data with action buttons.
- Contextual quick actions adapt to room services.
- **Passive skills now process per turn in battle (mpRegen, persistent buffs).**
- **Counter-attacks now trigger based on counterChance on any skill.**
- **Ground items and pickup system work; collect quests can be triggered.**
- **Faction advancement, reputation, and rank progression work.**
- **Death penalty and revive system work.**
- **Skill experience gained from combat; skill level-up works.**
- **Equipment durability consumed in battle; repair at blacksmith works.**
- **Free attribute point allocation works.**
- **Battle log history query works.**

## What Is Not Yet Trustworthy

- PVP fairness and disconnect edge cases not tested.
- Faction-exclusive skill tree content (rankRequired skills in skills.json) not yet populated.
- Achievement system not yet wired to gameplay triggers (checkAllAchievements not called on battle end, level up, etc.).
- Faction quest socket integration missing (accept/complete/progress tracking).
- 采集/炼药/烹饪生活技能未开始。

## Sources Of Truth

Use these as truth in this order:

1. Runtime code in `server/src` and `client/src`
2. Content data in `config/json`
3. Notes in `ai_read`
4. Legacy status docs like `PROJECT_STATUS.md`

## Current Development Strategy

Do not try to "finish the whole game" in one jump.

Preferred order:

1. Stabilize core gameplay loop ✅
2. Remove model/config mismatches ✅
3. Make UI reflect actual server capabilities ✅
4. Expand content only after systems are reliable ✅
5. Keep `ai_read` updated so multi-AI work does not drift ✅
6. Update client UI to reflect all new server capabilities ✅ (Phase 5)
7. Social & interaction systems ✅ (Phase 6)
8. Content depth expansion 🔶 (Phase 7 - 部分在工作区)
9. Economy & balance 🔶 (Phase 8 - 天气已完成，其余待开始)
10. **Next**: 完成 Phase 7-8 剩余项 → Phase 9 (GM后台) → Phase 10 (安全)
