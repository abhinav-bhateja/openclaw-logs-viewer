# AGENTS.md

## Cursor Cloud specific instructions

### Overview

OpenClaw Log Viewer — a single-service Node.js web app (React 19 + Vite 7 frontend, Express 4 + WebSocket backend) that displays JSONL log files from `/home/ubuntu/.openclaw/`.

### Running the app

- **Dev mode**: `npm run dev` — starts both Vite dev server (port 5173) and Express backend (port 3099) via `concurrently`.
- **Production mode**: `npm run build && npm start` — builds frontend to `dist/` then serves everything on port 3099.
- See `package.json` `scripts` for all available commands.

### Data directory

The server reads JSONL files from `/home/ubuntu/.openclaw/`. Required subdirectories:
- `agents/main/sessions/` — session log files (`*.jsonl`)
- `logs/` — `commands.log` and `config-audit.jsonl`
- `cron/runs/` — cron run log files (`*.jsonl`)

If this directory doesn't exist, API endpoints will return 500 errors. Create it with sample data for local development. Paths are hardcoded in `server.js`.

### Lint / Test

No ESLint or test framework is currently configured. The project has no automated tests.

### Key gotchas

- The `.codex/instructions.md` says "do NOT run npm install" and "network is unavailable" — ignore this in Cursor Cloud; `npm install` works fine and is required.
- No database or external services needed; all data comes from flat JSONL files on disk.
- Vite dev server proxies `/api` and `/ws` requests to `http://localhost:3099` (configured in `vite.config.js`).
