# OpenClaw Log Viewer - Context

## Log Sources

All logs are in `/home/ubuntu/.openclaw/`:

### 1. Session Logs (`agents/main/sessions/*.jsonl`)
- JSONL format, one JSON object per line
- Types: `session`, `message`, `thinking_level_change`, `custom`
- Messages have `role` (user/assistant), `content` array with `type` and `text`
- Include `usage` with token counts and costs
- `.reset.` files are archived sessions

### 2. Command Log (`logs/commands.log`)
- JSONL with session actions (new sessions, etc.)
- Fields: timestamp, action, sessionKey, senderId, source

### 3. Config Audit (`logs/config-audit.jsonl`)
- JSONL tracking config file changes
- Fields: ts, source, event, configPath, previousHash, nextHash, suspicious

### 4. Cron Runs (`cron/runs/*.jsonl`)
- JSONL for scheduled task executions

## Sample Session Log Entry
```json
{"type":"message","id":"910c32aa","parentId":"0cad8194","timestamp":"2026-02-21T20:32:38.564Z","message":{"role":"user","content":[{"type":"text","text":"Hello world"}],"timestamp":1771705958562}}
```

## Sample Message with Usage
```json
{"type":"message","id":"8b9fe22d","parentId":null,"timestamp":"2026-02-21T20:32:38.477Z","message":{"role":"assistant","content":[{"type":"text","text":"Response text here"}],"api":"openai-responses","provider":"openclaw","model":"delivery-mirror","usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"totalTokens":0,"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}},"stopReason":"stop","timestamp":1771705958477}}
```
