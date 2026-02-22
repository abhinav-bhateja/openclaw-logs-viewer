# OpenClaw Log Viewer - Codex Instructions

## Project Context
This is a log viewer for OpenClaw (an AI agent framework). It was a vanilla HTML/JS app, now being migrated to React + Vite.

Read `CONTEXT.md` for log source details and data formats.
Read `server.js` for the existing API endpoints.
Read `public/index.html` for the OLD frontend (reference only).

## What's Already Done
- All npm dependencies are installed (react 19, vite 7, tailwindcss 4, @tailwindcss/vite, ws, lucide-react, clsx, tailwind-merge, class-variance-authority, @radix-ui/react-dialog, @radix-ui/react-scroll-area, @radix-ui/react-slot, concurrently)
- Vite config: `vite.config.js` (with React plugin, @tailwindcss/vite plugin, proxy to :3099, alias @ -> src/)
- Entry point: `index.html` (root level, loads src/main.jsx)
- `src/main.jsx` — React root mount
- `src/App.jsx` — placeholder
- `src/index.css` — Tailwind v4 import + CSS vars
- Tailwind v4 uses CSS-based config (`@import "tailwindcss"` in CSS), NOT tailwind.config.js
- **DO NOT run npm install** — all deps are already present. Network is unavailable in sandbox.

## Task: Major UI Refactor

### Requirements

1. **Convert to React + shadcn/ui**
   - Use Vite for bundling
   - Install and configure shadcn/ui with the dark theme
   - Keep Express as the API backend (port 3099)
   - Vite dev server can proxy to Express, but production build should be served by Express from `dist/`

2. **Sessions sidebar layout**
   - Sessions list moves to a LEFT SIDEBAR (always visible on desktop, collapsible on mobile)
   - Clicking a session loads its messages in the main content area
   - The most recent active session should be selected by default on load
   - Other nav items (Commands, Config Audit, Cron, Stats) stay in the sidebar above or below sessions

3. **WebSocket for live log streaming**
   - Add a WebSocket server (use `ws` package) alongside Express in `server.js`
   - When a session is selected, the frontend opens a WebSocket connection
   - Server watches the session's JSONL file with `fs.watch()` and pushes new lines to the client
   - New messages appear in real-time without page refresh
   - The "Auto Refresh" button should be REMOVED — WebSocket replaces it entirely
   - Auto-scroll to bottom when new messages arrive (unless user has scrolled up)

4. **Keep UI and animations modular**
   - Components should be well-separated (Sidebar, SessionList, MessageView, CommandsView, etc.)
   - Animation logic (transitions, scroll behavior) should be in dedicated hooks or utility files
   - We'll improve animations later, so don't over-invest — just make the structure clean

5. **Preserve all existing functionality**
   - All current views must still work: Sessions, Commands, Config Audit, Cron, Stats
   - Session detail view with message bubbles, thinking blocks, tool calls
   - Search/filter functionality
   - Token/cost display

### Technical Notes
- Log files are at `/home/ubuntu/.openclaw/agents/main/sessions/*.jsonl`
- The Express server already parses these — reuse that logic
- For WebSocket file watching, watch the specific session file and stream only new lines (track byte offset)
- Use `npx shadcn@latest init` and add components as needed
- Keep the dark theme aesthetic (slate-950 background, blue accents)

### Don't
- Don't change the Express API endpoints (keep backward compat)
- Don't add authentication
- Don't add a database
- Don't over-engineer animations yet
