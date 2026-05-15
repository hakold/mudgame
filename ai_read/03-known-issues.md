# Known Issues

All previously tracked issues have been resolved as of 2026-05-15 Phase 4.

## Resolved Issues

- ✅ `skill_meditation` had empty `buff: { duration: 999 }` — removed; now only `mpRegen: 5` (passive_mp_regen effect)
- ✅ `questConfig.reward` → `questConfig.rewards` — fixed in Phase 2
- ✅ `skill_heal` → `skill_heal_basic` — fixed in Phase 2
- ✅ NPC trainer skill IDs (`basic_attack` → `skill_basic_attack`, etc.) — fixed in Phase 4
- ✅ Passive skills (mpRegen, persistent buffs) not processed per turn — fixed in Phase 4
- ✅ Counter-attack mechanic not implemented — fixed in Phase 4
- ✅ `collect` quest type had no trigger event — fixed in Phase 4 (pickup_item triggers checkProgress)
- ✅ No death penalty or revive system — fixed in Phase 4
- ✅ No faction advancement system — fixed in Phase 4
- ✅ No skill experience from combat — fixed in Phase 4
- ✅ No equipment durability consumption — fixed in Phase 4
- ✅ No attribute point allocation — fixed in Phase 4
- ✅ No battle log query — fixed in Phase 4

## Remaining Known Gaps

- Client UI does not yet render: ground drops panel, faction rank/reputation, durability bars, battle log viewer, attribute allocation UI, revive button on death, skill level-up notifications
- Faction-exclusive skill tree content (`rankRequired` skills in skills.json) not yet populated — only the system is ready
- PVP fairness and disconnect edge cases not tested
- NPC-specific services not fully surfaced as room actions in client UI
