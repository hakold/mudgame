# Roadmap

This roadmap is intentionally practical. The goal is to make the game more stable and more complete step by step.

## Phase 1: Stabilize The Core Loop ✅

Target: A new player can register, move, fight, loot, buy gear, equip gear, rest, and continue playing without hard blockers.

Completed tasks:
1. Quest progress hooks for combat, learning, and interaction events.
2. Battle end events, turn system, monster auto-turns, status effects.
3. Smoke test for the new-player loop.
4. Inventory, skills, and quests refresh after all key actions.
5. Battle skill support for attack/heal/buff/debuff/defense + status effects.

## Phase 2: Make Systems Internally Consistent ✅

Target: Config data, models, and runtime logic stop contradicting each other.

Completed tasks:
1. Standardized item schema (all weapons/armor use `stats`, consumables use `effects` array).
2. Standardized skill config format and runtime execution (passive duration, reflect via buff, monster skill refs fixed).
3. Quest config aligned with progression code (`minLevel` check, `rewards` field name fixed).
4. All monster drops and item references validated (zero cross-reference errors).

## Phase 3: Improve UX And Clarity ✅

Target: The interface shows only actions that are currently meaningful and available.

Completed tasks:
1. Contextual room actions extended beyond `rest` and `shop` (train, learn_skill, quest).
2. Inventory/skill/quest panels show details and action buttons.
3. Improved feedback: item descriptions/stats/rarity, skill type/MP, quest rewards/status.
4. Panels feel live with explicit use/equip/sell buttons and equipped state.

## Phase 4: Expand Wuxia Gameplay Depth

Target: Move from demo-like feature coverage to a coherent game progression experience.

Recommended tasks:

1. **Passive skill processing** — implement mpRegen per turn and persistent buff effects in battleService.
2. **Faction progression** — faction-specific skill access, faction reputation, faction quests.
3. **More reliable quest chains** — auto-offer next quest on completion, daily quest reset logic.
4. **Better combat variety** — implement counter-attack mechanic, cooldown tracking, stacking status rules.
5. **Equipment progression** — enhance/upgrade system, set bonuses, durability decay.
6. **Economy balance** — tune prices, drop rates, and gold sinks across rooms and monsters.
7. **Loot/pickup system** — trigger `collect` quest objectives, ground items in rooms.
8. **PVP validation** — end-to-end test for arena battles, fairness checks.

## Working Rule For Future AI

If unsure what to do next, work on the smallest change that improves Phase 4 depth without adding speculative architecture.
