# Task: Add Live Streaming to OpenClaw Log Viewer

## Problem
The log viewer currently only shows complete messages (watches JSONL file). We need real-time token streaming so users see text appear as the model generates it.

## Architecture

### How it works now
- `server.js` watches JSONL session files with `fs.watch`
- Frontend connects via WebSocket to `/ws/sessions/<name>`
- Server sends `{ type: "line", record }` when new complete lines appear in the file
- Messages only appear after the full response is written to JSONL

### What we need
The OpenClaw Gateway (port 18789) has a WebSocket protocol that streams live `agent` events including `text_delta` during generation. The server needs to:

1. Connect to Gateway WS at `ws://localhost:18789` as an operator client
2. Subscribe to agent/chat events
3. Forward streaming deltas to frontend clients watching the relevant session
4. Frontend renders streaming text in real-time with a "streaming" indicator
5. When the final JSONL entry arrives (via existing file watcher), replace the streaming preview with the complete message

### Gateway WS Protocol
- Transport: WebSocket, text frames with JSON payloads
- First frame must be a `connect` request
- Auth token: read from env var `OPENCLAW_GATEWAY_TOKEN` (fallback: `ffae72eface986b147f67f818672b165299d6440585ae30f`)

Connect handshake:
```json
{
  "type": "req",
  "id": "connect-1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "logs-viewer",
      "version": "1.0.0",
      "platform": "linux",
      "mode": "operator"
    },
    "role": "operator",
    "scopes": ["operator.read"],
    "caps": [],
    "commands": [],
    "permissions": {},
    "auth": { "token": "<TOKEN>" }
  }
}
```

Gateway sends back `hello-ok` on success. Then it broadcasts events:
- `{ type: "event", event: "agent", payload: { ... } }` — agent run events including text deltas
- `{ type: "event", event: "chat", payload: { ... } }` — chat events

The `agent` events contain streaming text deltas during model generation. Look for text content in the payload and forward it to frontend clients.

NOTE: The exact event payload structure may vary. The server should log received events initially to understand the format, then extract text deltas appropriately. Key things to look for in agent events: `text`, `delta`, `content`, `text_delta` fields.

### Implementation Plan

#### server.js changes:
1. Add a Gateway WS client that connects on startup (with auto-reconnect)
2. Parse incoming `agent`/`chat` events from Gateway
3. Maintain a map of which frontend WS clients are watching which sessions
4. Forward streaming deltas to relevant frontend clients as `{ type: "stream", delta: "text chunk", sessionKey: "..." }`
5. Send `{ type: "stream_end", sessionKey: "..." }` when generation completes

#### Frontend changes (MessageView.jsx + useWebSocket.js):
1. Handle `stream` message type — show a "streaming" message bubble at the bottom
2. Accumulate deltas into the streaming bubble's text
3. Handle `stream_end` — the existing file watcher will deliver the final complete message
4. Show a pulsing indicator while streaming is active
5. Auto-scroll to bottom during streaming

### Key Files
- `server.js` — Express + WS server (add Gateway client here)
- `src/hooks/useWebSocket.js` — Frontend WS hook
- `src/components/MessageView.jsx` — Message rendering (add streaming bubble)
- `src/App.jsx` — Main app (handles WS messages)
- `src/lib/format.js` — Utilities

### Constraints
- Don't break existing file-watching functionality
- Gateway connection should be resilient (auto-reconnect)
- Keep it simple — this is a viewer, not a chat client
- The streaming bubble should look distinct (maybe a subtle animation/glow)
- Use existing styling patterns (Tailwind, slate color scheme)

### Environment
- Gateway runs at ws://localhost:18789
- Token for auth: use env var OPENCLAW_GATEWAY_TOKEN
- Node.js, Express, ws library already installed
- React frontend with Vite

### Testing
After implementation, build with `npm run build` to verify no build errors.
