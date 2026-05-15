# Known Issues

This file lists the most important codebase issues discovered so far.

## High Priority

### 1. Battle status system is usable, but passive/counter mechanics are not implemented

File:

- `server/src/game/battleService.js`
- `config/json/skills.json`

Problem:

- Passive skills (`skill_meditation`, `skill_yijinjing`) have `mpRegen` and `buff.duration: 999` but battle service does not process passive effects per turn.
- `counterChance` on `skill_wudang_fist` is defined but never consumed.
- These fields are carried forward as future mechanics.

Recommendation:

- Implement passive effect processing (mpRegen per turn, persistent buffs) in a future slice.
- Implement counter-attack mechanic when combat variety is expanded.

### 2. Quest `collect` objective type has no trigger event

Files:

- `server/src/game/questProgressService.js`
- `config/json/quests.json`

Problem:

- `quest_side_herb_collection` uses `collect` type but no loot/pickup system exists to trigger it.

Recommendation:

- Add a loot/pickup system to trigger `collect` objectives, or convert this quest to use `buy` or `kill` objectives instead.

## Medium Priority

### 3. Battle balance and lifecycle still need deeper validation

File:

- `server/src/game/battleService.js`
- `server/src/socket/index.js`

Problem:

- PVP fairness, disconnect edge cases, and long-running combat behavior still need end-to-end testing.

Recommendation:

- Run explicit battle smoke tests for PVE and PVP before expanding content further.

### 4. Room services and NPC services are not fully unified

Files:

- `config/json/rooms.json`
- `config/json/npcs.json`
- `server/src/socket/index.js`

Problem:

- Some interactions are room-based (services array), some NPC-flavored (NPC type/services), some only implied by content.
- The UI now drives contextual actions from room services, but NPC-specific services (faction NPCs, quest NPCs) are not surfaced as room actions.

Recommendation:

- Decide whether service availability is primarily room-driven, NPC-driven, or a combination with explicit rules.

### 5. `PROJECT_STATUS.md` overstates feature completeness

Problem:

- It marks many systems as "done", but the runtime implementation is still partial in several places.

Recommendation:

- Treat it as a historical bootstrap file, not a reliability document.

## Resolved Issues

- Item schema inconsistency: flat-field weapons/armor now use `stats` format matching `Inventory.calculateAttributes()`. (Fixed Phase 2)
- Skill model mismatch: `CharacterSkill.js` now uses actual config fields. Passive skills have `duration: 999`. (Fixed Phase 2)
- Quest `complete_quest` emit used `questConfig.reward` instead of `questConfig.rewards`. (Fixed Phase 2)
- Monster skill reference `skill_heal` (non-existent) → `skill_heal_basic`. (Fixed Phase 2)
- Quest `learn_skill` objectives with `minLevel` now checked by `questProgressService`. (Fixed Phase 2)
- Content cross-references all validated with zero errors. (Fixed Phase 2)
- Client panels now show item details, skill info, quest rewards, and action buttons. (Fixed Phase 3)
- Contextual room actions now include train, learn_skill, quest buttons. (Fixed Phase 3)
