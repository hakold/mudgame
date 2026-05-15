# Current State

## What Was Recently Fixed

Recent work completed on 2026-05-15 (Phase 2 + Phase 3):

- **Phase 2 (Internal Consistency):**
  - Standardized item schema: all weapons/armor use `stats` format; consumables use `effects` array; `item_herb` fixed.
  - Standardized skill config: passive skills have persistent duration; `skill_mingjiao_qiankun` uses buff-based reflect; fixed `skill_heal` → `skill_heal_basic` monster reference; fixed `questConfig.reward` → `questConfig.rewards` emit.
  - Quest progression: `learn_skill` objectives with `minLevel` now validated.
  - Content validation script passes with zero cross-reference errors.
- **Phase 3 (UX Clarity):**
  - Contextual room actions now include train, learn_skill, and quest buttons.
  - Inventory panel: explicit use/equip/sell buttons, item descriptions, stat display, rarity coloring.
  - Skill panel: descriptions, MP cost, type tags.
  - Quest panel: colored status badges, reward preview, claimed state.

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

## What Is Not Yet Trustworthy

- Passive skill effects (mpRegen, persistent buffs) not processed per turn in battle.
- Counter-attack mechanic defined but not implemented.
- `collect` quest objective type has no trigger event.
- PVP fairness and disconnect edge cases not tested.
- NPC-specific services not surfaced as room actions in UI.

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
4. Expand content only after systems are reliable
5. Keep `ai_read` updated so multi-AI work does not drift
