# Current State

## Phase 1-10: ✅ ALL COMPLETE (2026-05-19)

All core gameplay, GM management, and security systems are implemented and functional.

### Phase 10 — Anti-Cheat & Security (New)

**Anti-Script Protection (防脚本):**
- Socket event rate limiter: per-user per-event limits (window + min interval), 3-tier penalty (warn → mute → kick)
- HTTP API rate limiter: login 10/min, register 3/hr per IP
- Unified guard: every socket event goes through `guardSocket()` → rate check → mute check → input validation → anti-cheat recording
- Behavioral analysis: detects mechanically-precise action intervals, repetitive single-action patterns, superhuman speed, and excessive daily volume
- 5 suspicion levels with automatic escalation: level 1-2 (log), level 3 (mute 30min), level 4 (auto-kick), level 5 (temp-ban 1hr)
- GM can view suspicious players via `/gm/anti-cheat/suspicious` and reset suspicion

**Input Validation:**
- `validatorService.js` with schema validation for 30+ socket events
- Strict type checking: safeString (XSS/injection prevention), safeId (alphanumeric only), safeInt (range-bounded)
- All inputs validated server-side — client is untrusted

**Session Security:**
- JWT token bound to device fingerprint (User-Agent hash) in production
- Single-device enforcement: new connection kicks old socket
- Login failure tracking: 5 failures locks account+IP for 15 minutes
- Password complexity: 8+ chars, must contain letter + number
- bcrypt saltRounds upgraded from 10 → 12

**Communication Security:**
- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, CSP, HSTS
- CORS strict mode in production
- HTTP request body limit: 1MB
- Production error handler: no stack traces exposed to client
- Socket.IO: 30s connect timeout, 25s ping interval, 60s timeout

**GM Permission Matrix:**
- 3-tier system: `gm` (view only), `senior_gm` (player modification), `admin` (config + GM management)
- Config mutations require admin-level permission
- Route-level permission checks on all GM endpoints

### Project File Count

| Category | Count | Details |
|----------|-------|---------|
| Models | 13 | User, CharacterSkill, Inventory, Quest, ChatMessage, BattleLog, Announcement, Achievement, Daily, Auction, Gang, ActionLog + index |
| Services | 14 | battle, questProgress, roomDrops, trade, achievement, weatherTime, craft, daily, auction, instance, gang, actionLog, validator, antiCheat |
| Middleware | 2 | auth (JWT+roles+login-tracking), rateLimiter (socket+HTTP) |
| Controllers | 3 | authController, playerController, gmController |
| Configs | 13 | maps, rooms, npcs, monsters, items, skills, quests, factions, factionQuests, achievements, forgeRecipes, gatheringNodes, alchemyRecipes, cookingRecipes, dungeons, weatherConfig |
| Client Views | 4 | Login, Register, Game, Admin |
| Client Stores | 1 | game.js (Pinia) |

### Deployment

See `docs/DEPLOYMENT.md` for complete deployment and operations manual.

---

*Last updated: 2026-05-19*
