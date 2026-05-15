# AI Read Folder

This folder is the handoff area for any AI working on this project.

Read files in this order before making non-trivial changes:

1. `README.md`
2. `01-project-overview.md`
3. `02-current-state.md`
4. `03-known-issues.md`
5. `04-roadmap.md`
6. `99-session-log.md`

Rules for future AI collaborators:

- Do not trust `PROJECT_STATUS.md` as the source of truth for implementation completeness.
- Treat the codebase and the files in `ai_read` as the real status.
- Before starting a substantial change, read at least `02-current-state.md` and `03-known-issues.md`.
- After every meaningful change, append a short entry to `99-session-log.md`.
- Keep notes concrete: what changed, why, files touched, validation done, risks left.
- Prefer updating existing files in `ai_read` over creating many new files unless a topic is large enough to deserve its own document.

Scope of this project:

- The game is a text RPG / MUD-inspired wuxia project.
- The current implementation is a room-based web game with Vue client + Node.js server + MongoDB + Redis.
- The long-term goal is not just "can run", but "can be iteratively expanded into a stable game".

