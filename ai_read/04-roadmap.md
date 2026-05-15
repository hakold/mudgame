# Roadmap

## Phase 1-3: Foundation ✅ COMPLETE

Core game loop, content, and UI panels.

## Phase 4: Expand Wuxia Gameplay Depth ✅ COMPLETE (2026-05-15)

### Batch 1: Core Combat Mechanics ✅
- Passive skill processing (mpRegen per turn, persistent buffs)
- Counter-attack mechanic (counterChance on any skill type)
- Room drops / pickup system (roomDropsService.js)
- Collect quest trigger (pickup_item → checkProgress)
- Bug fixes (NPC skill IDs, empty buff on meditation)

### Batch 2: Faction Progression & Death ✅
- Faction advancement (reputation, contribution, rank: disciple→deacon→elder→leader)
- Faction tasks (gold donation for reputation)
- Rank-gated skill learning (rankRequired field support)
- Skill experience from combat (skills used in battle gain EXP)
- Death penalty (10% EXP loss, 5% gold loss, equipment durability loss)
- Revive system (30% HP/MP, teleport to village_center)

### Batch 3: UI & Equipment Systems ✅
- Battle log query (get_battle_logs, get_battle_detail socket events)
- Attribute point allocation (allocate_points socket event, freePoints from level-up and faction advance)
- Equipment durability (battle consumes 1-3 per item, death 10 extra; repair_item/repair_all at blacksmith)

### Env Configuration ✅
- Server `.env.example` with all configurable fields
- Client `.env.example` with VITE_API_URL and VITE_SOCKET_URL
- `.gitignore` excludes `.env` files

## Phase 5: Client UI Update (NEXT)

Update client Vue components to reflect all new server capabilities:
- Ground drops panel in room view
- Faction rank/reputation display
- Durability bars on equipment
- Battle log viewer
- Attribute allocation UI
- Revive button on death screen
- Skill level-up notifications
- Repair button at blacksmith rooms

## Phase 6: Content Expansion

- Populate faction-exclusive skill trees (rankRequired skills)
- Add more faction tasks and quests
- Expand map content
- Balance tuning
