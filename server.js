const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = 3099;

const SESSIONS_DIR = '/home/ubuntu/.openclaw/agents/main/sessions';
const COMMANDS_LOG = '/home/ubuntu/.openclaw/logs/commands.log';
const CONFIG_AUDIT_LOG = '/home/ubuntu/.openclaw/logs/config-audit.jsonl';
const CRON_RUNS_DIR = '/home/ubuntu/.openclaw/cron/runs';

const DIST_DIR = path.join(__dirname, 'dist');
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATIC_DIR = fs.existsSync(DIST_DIR) ? DIST_DIR : PUBLIC_DIR;

app.use(express.json());
app.use(express.static(STATIC_DIR));

function safeJsonParse(line, file, lineNumber) {
  if (!line || !line.trim()) {
    return null;
  }

  try {
    return JSON.parse(line);
  } catch (error) {
    return {
      _parseError: true,
      file,
      lineNumber,
      raw: line,
      error: error.message,
    };
  }
}

async function parseJsonlFile(filePath) {
  const content = await fsp.readFile(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line, index) => safeJsonParse(line, filePath, index + 1))
    .filter(Boolean);
}
// In-memory label cache: "filename:mtime" -> label string
const labelCache = new Map();

function extractLabelFromText(text) {
  if (!text) return null;
  // Heartbeat
  if (/heartbeat/i.test(text.slice(0, 200))) return 'Heartbeat';
  // Cron job: [cron:id job-name]
  const cronMatch = text.match(/^\[cron:[^\s]+ ([^\]]+)\]/);
  if (cronMatch) return `⏰ ${cronMatch[1]}`;
  // New/reset session (no channel)
  if (/new session was started via \/new|\/reset/.test(text.slice(0, 300))) return 'Main';
  // Extract conversation_label from JSON block
  const labelMatch = text.match(/"conversation_label"\s*:\s*"([^"]+)"/);
  if (labelMatch) {
    const label = labelMatch[1];
    const guildMatch = label.match(/Guild (#[^\s]+)/);
    if (guildMatch) return guildMatch[1];
    if (label.startsWith('telegram:')) return 'Telegram';
    if (label.startsWith('channel:')) return 'Discord';
    return label;
  }
  // System message (compaction, audit) — still main session
  if (/Post-Compaction|Compaction failed|compaction/i.test(text.slice(0, 300))) return 'Main';
  return null; // will fall back to date-based label
}

async function getSessionLabel(filePath, mtime) {
  const cacheKey = `${filePath}:${mtime}`;
  if (labelCache.has(cacheKey)) return labelCache.get(cacheKey);

  let label = null;
  try {
    // Read first 8KB — enough to find the first user message
    const fd = await fsp.open(filePath, 'r');
    const buf = Buffer.alloc(8192);
    const { bytesRead } = await fd.read(buf, 0, 8192, 0);
    await fd.close();
    const chunk = buf.slice(0, bytesRead).toString('utf8');
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      let rec;
      try { rec = JSON.parse(line); } catch { continue; }
      if (rec.type !== 'message') continue;
      const msg = rec.message || {};
      if (msg.role !== 'user') continue;
      // Extract decoded text from content array
      const content = Array.isArray(msg.content) ? msg.content : [];
      for (const item of content) {
        if (item && item.type === 'text' && item.text) {
          // item.text is already decoded — regex works correctly here
          label = extractLabelFromText(item.text);
          break;
        }
      }
      break;
    }
  } catch {
    // ignore read errors
  }

  // No user message found — likely a compaction/system-only session
  if (label === null) label = 'Main';

  labelCache.set(cacheKey, label);
  return label;
}

function dateLabel(mtime) {
  const d = new Date(mtime);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}



function getSessionMeta(name, stats) {
  const isArchived = name.includes('.reset.');
  const id = name;
  const sessionId = name.split('.jsonl')[0];
  const archivedAt = isArchived ? name.split('.reset.')[1] || null : null;

  return {
    id,
    name,
    sessionId,
    isArchived,
    archivedAt,
    sizeBytes: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
  };
}

async function countMessages(filePath) {
  try {
    const content = await fsp.readFile(filePath, 'utf8');
    let count = 0;
    for (const line of content.split('\n')) {
      if (line.includes('"type":"message"') || line.includes('"type": "message"')) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

async function listSessionFiles() {
  const entries = await fsp.readdir(SESSIONS_DIR, { withFileTypes: true });
  const sessionFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.jsonl'));

  const withMeta = await Promise.all(
    sessionFiles.map(async (name) => {
      const fullPath = path.join(SESSIONS_DIR, name);
      const stats = await fsp.stat(fullPath);
      const meta = getSessionMeta(name, stats);
      [meta.label, meta.messageCount] = await Promise.all([
        getSessionLabel(fullPath, stats.mtime.getTime()).then((l) => l || dateLabel(stats.mtime)),
        countMessages(fullPath),
      ]);
      return meta;
    })
  );

  return withMeta.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

async function parseSessionFileByName(fileName) {
  const available = await listSessionFiles();
  const found = available.find((session) => session.name === fileName);

  if (!found) {
    const error = new Error('Session not found');
    error.status = 404;
    throw error;
  }

  const filePath = path.join(SESSIONS_DIR, found.name);
  const records = await parseJsonlFile(filePath);

  const messages = records
    .filter((record) => record && record.type === 'message' && record.message)
    .map((record) => ({
      id: record.id,
      parentId: record.parentId,
      timestamp: record.timestamp,
      ...record.message,
    }));

  const meta = records.find((record) => record && record.type === 'session') || null;

  const changes = records.filter(
    (record) => record && record.type !== 'message' && record.type !== 'session'
  );

  return {
    session: found,
    meta,
    messages,
    events: changes,
    parseErrors: records.filter((record) => record && record._parseError),
  };
}

app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await listSessionFiles();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (id.includes('/') || id.includes('..')) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const data = await parseSessionFileByName(id);
    res.json(data);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

app.get('/api/logs/commands', async (req, res) => {
  try {
    const rows = await parseJsonlFile(COMMANDS_LOG);
    rows.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    res.json({ commands: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logs/config-audit', async (req, res) => {
  try {
    const rows = await parseJsonlFile(CONFIG_AUDIT_LOG);
    rows.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
    res.json({ events: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cron', async (req, res) => {
  try {
    const entries = await fsp.readdir(CRON_RUNS_DIR, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.endsWith('.jsonl'));

    const runs = await Promise.all(
      files.map(async (name) => {
        const fullPath = path.join(CRON_RUNS_DIR, name);
        const stats = await fsp.stat(fullPath);
        const lines = await parseJsonlFile(fullPath);
        return {
          id: name,
          name,
          modifiedAt: stats.mtime,
          sizeBytes: stats.size,
          entries: lines,
          latest: lines[lines.length - 1] || null,
        };
      })
    );

    runs.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
    res.json({ runs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const sessions = await listSessionFiles();
    let totalMessages = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;

    for (const session of sessions) {
      const filePath = path.join(SESSIONS_DIR, session.name);
      const rows = await parseJsonlFile(filePath);

      for (const row of rows) {
        if (!row || row._parseError || row.type !== 'message' || !row.message) {
          continue;
        }

        totalMessages += 1;
        const usage = row.message.usage || {};
        const cost = usage.cost || {};

        totalInputTokens += Number(usage.input || usage.input_tokens || 0);
        totalOutputTokens += Number(usage.output || usage.output_tokens || 0);
        totalTokens += Number(usage.totalTokens || usage.total_tokens || 0);
        totalCost += Number(cost.total || usage.total_cost || 0);
      }
    }

    res.json({
      totalSessions: sessions.length,
      activeSessions: sessions.filter((session) => !session.isArchived).length,
      archivedSessions: sessions.filter((session) => session.isArchived).length,
      totalMessages,
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalTokens,
      },
      costs: {
        total: totalCost,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const WS_OPEN = 1;

// Track which frontend clients are watching which sessions
// Map<sessionName, Set<ws>>
const sessionClients = new Map();

function addSessionClient(sessionName, ws) {
  if (!sessionClients.has(sessionName)) {
    sessionClients.set(sessionName, new Set());
  }
  sessionClients.get(sessionName).add(ws);
}

function removeSessionClient(sessionName, ws) {
  const clients = sessionClients.get(sessionName);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) sessionClients.delete(sessionName);
  }
}

function broadcastToSession(sessionName, payload) {
  const clients = sessionClients.get(sessionName);
  if (!clients) return;
  const data = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WS_OPEN) ws.send(data);
  }
}

function broadcastToAll(payload) {
  const data = JSON.stringify(payload);
  for (const clients of sessionClients.values()) {
    for (const ws of clients) {
      if (ws.readyState === WS_OPEN) ws.send(data);
    }
  }
}

// --- Gateway WS Client (streaming deltas) ---
const WebSocket = require('ws');
const crypto = require('crypto');
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'ws://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'ffae72eface986b147f67f818672b165299d6440585ae30f';

// Load device identity for crypto handshake
// Supports env vars (for Docker) or file-based identity
let deviceIdentity = null;
let deviceAuth = null;
try {
  if (process.env.OPENCLAW_DEVICE_ID && process.env.OPENCLAW_PRIVATE_KEY) {
    deviceIdentity = {
      deviceId: process.env.OPENCLAW_DEVICE_ID,
      publicKeyPem: process.env.OPENCLAW_PUBLIC_KEY,
      privateKeyPem: process.env.OPENCLAW_PRIVATE_KEY,
    };
    if (process.env.OPENCLAW_DEVICE_TOKEN) {
      deviceAuth = { tokens: { operator: { token: process.env.OPENCLAW_DEVICE_TOKEN } } };
    }
    console.log('[gateway] Loaded device identity from env vars');
  } else {
    const IDENTITY_DIR = '/home/ubuntu/.openclaw/identity';
    deviceIdentity = JSON.parse(fs.readFileSync(path.join(IDENTITY_DIR, 'device.json'), 'utf8'));
    deviceAuth = JSON.parse(fs.readFileSync(path.join(IDENTITY_DIR, 'device-auth.json'), 'utf8'));
    console.log('[gateway] Loaded device identity from files');
  }
} catch (e) {
  console.log('[gateway] Warning: could not load device identity:', e.message);
}

function signChallenge(nonce) {
  if (!deviceIdentity) return null;
  const signedAt = Date.now();
  const privateKey = crypto.createPrivateKey(deviceIdentity.privateKeyPem);
  // v2 payload: deviceId + nonce + signedAt
  const payload = `${deviceIdentity.deviceId}\n${nonce}\n${signedAt}`;
  const signature = crypto.sign(null, Buffer.from(payload), privateKey).toString('base64');
  return { signature, signedAt };
}

let gatewayWs = null;
let gatewayReconnectTimer = null;

function connectToGateway() {
  if (gatewayWs) return;
  if (!deviceIdentity) {
    console.log('[gateway] No device identity — skipping gateway connection');
    return;
  }

  try {
    const ws = new WebSocket(GATEWAY_URL);
    gatewayWs = ws;

    let connected = false;

    ws.on('open', () => {
      console.log('[gateway] Connected to OpenClaw Gateway, waiting for challenge...');
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // Wait for challenge, then send connect with signed nonce
      if (msg.type === 'event' && msg.event === 'connect.challenge' && !connected) {
        const nonce = msg.payload && msg.payload.nonce;
        console.log('[gateway] Got challenge, signing and connecting...');
        const signed = signChallenge(nonce);
        if (!signed) {
          console.log('[gateway] Failed to sign challenge');
          return;
        }
        // Use device token if available, fall back to gateway token
        const authToken = (deviceAuth && deviceAuth.tokens && deviceAuth.tokens.operator && deviceAuth.tokens.operator.token) || GATEWAY_TOKEN;
        ws.send(JSON.stringify({
          type: 'req',
          id: 'connect-1',
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'cli',
              version: '1.0.0',
              platform: 'linux',
              mode: 'cli',
            },
            role: 'operator',
            scopes: ['operator.read'],
            caps: [],
            commands: [],
            permissions: {},
            auth: { token: authToken },
            device: {
              id: deviceIdentity.deviceId,
              publicKey: deviceIdentity.publicKeyPem,
              signature: signed.signature,
              signedAt: signed.signedAt,
              nonce: nonce,
            },
          },
        }));
        return;
      }

      if (msg.type === 'res' && msg.id === 'connect-1') {
        if (msg.ok) {
          connected = true;
          console.log('[gateway] Handshake OK — streaming enabled');
        } else {
          console.log('[gateway] Handshake failed:', JSON.stringify(msg.error));
        }
        return;
      }

      if (msg.type !== 'event') return;

      const event = msg.event;
      const payload = msg.payload || {};

      // Extract text delta from agent events
      // The exact structure varies — check common patterns
      if (event === 'agent' || event === 'chat') {
        let delta = null;
        let sessionKey = payload.sessionId || payload.session_id || payload.sessionKey || null;
        let isDone = false;

        // Check various payload shapes for text deltas
        if (typeof payload.text_delta === 'string') {
          delta = payload.text_delta;
        } else if (typeof payload.delta === 'string') {
          delta = payload.delta;
        } else if (typeof payload.text === 'string' && payload.type === 'text_delta') {
          delta = payload.text;
        } else if (payload.content && typeof payload.content.text === 'string' && payload.content.type === 'text_delta') {
          delta = payload.content.text;
        } else if (payload.type === 'content_block_delta' && payload.delta) {
          delta = payload.delta.text || payload.delta.value || null;
        }

        // Check for stream end signals
        if (payload.type === 'message_stop' || payload.type === 'content_block_stop' ||
            payload.type === 'agent_end' || payload.type === 'done' || payload.done === true) {
          isDone = true;
        }

        if (delta !== null) {
          // If we know the session, target it; otherwise broadcast to all
          if (sessionKey) {
            // Try to find the matching JSONL filename
            const matchingFile = findSessionFile(sessionKey);
            if (matchingFile) {
              broadcastToSession(matchingFile, { type: 'stream', delta, sessionKey });
            } else {
              broadcastToAll({ type: 'stream', delta, sessionKey });
            }
          } else {
            broadcastToAll({ type: 'stream', delta, sessionKey: null });
          }
        }

        if (isDone) {
          if (sessionKey) {
            const matchingFile = findSessionFile(sessionKey);
            if (matchingFile) {
              broadcastToSession(matchingFile, { type: 'stream_end', sessionKey });
            } else {
              broadcastToAll({ type: 'stream_end', sessionKey });
            }
          } else {
            broadcastToAll({ type: 'stream_end', sessionKey: null });
          }
        }
      }
    });

    ws.on('close', () => {
      console.log('[gateway] Disconnected from Gateway, reconnecting in 3s...');
      gatewayWs = null;
      scheduleGatewayReconnect();
    });

    ws.on('error', (err) => {
      console.log('[gateway] Connection error:', err.message);
      ws.close();
    });
  } catch (err) {
    console.log('[gateway] Failed to connect:', err.message);
    gatewayWs = null;
    scheduleGatewayReconnect();
  }
}

function scheduleGatewayReconnect() {
  if (gatewayReconnectTimer) return;
  gatewayReconnectTimer = setTimeout(() => {
    gatewayReconnectTimer = null;
    connectToGateway();
  }, 3000);
}

// Simple lookup: find session JSONL file that starts with a sessionKey UUID
const sessionFileCache = new Map(); // sessionKey -> filename
function findSessionFile(sessionKey) {
  if (!sessionKey) return null;
  if (sessionFileCache.has(sessionKey)) return sessionFileCache.get(sessionKey);
  // Can't do async lookup here; cache is populated when clients connect
  return null;
}

function cacheSessionFile(sessionName) {
  // Extract UUID prefix from filename (e.g. "abc123-def.jsonl" -> "abc123-def")
  const sessionId = sessionName.split('.jsonl')[0];
  sessionFileCache.set(sessionId, sessionName);
  // Also cache with just first segment for partial matches
  const prefix = sessionId.split('-')[0];
  if (prefix) sessionFileCache.set(prefix, sessionName);
}

function parseSessionNameFromUpgrade(req) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const match = requestUrl.pathname.match(/^\/ws\/sessions\/(.+)$/);
  if (!match) return null;

  const raw = decodeURIComponent(match[1]);
  if (!raw || raw.includes('/') || raw.includes('..')) {
    return null;
  }

  return raw;
}

function sendWs(ws, payload) {
  if (ws.readyState === WS_OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

async function setupSessionStream(ws, sessionName) {
  const sessions = await listSessionFiles();
  const found = sessions.find((session) => session.name === sessionName);

  if (!found) {
    sendWs(ws, { type: 'error', error: 'Session not found' });
    ws.close(1008, 'Session not found');
    return;
  }

  const filePath = path.join(SESSIONS_DIR, found.name);
  let offset = (await fsp.stat(filePath)).size;
  let remainder = '';
  let watcher = null;
  let reading = false;
  let rerun = false;

  // Track this client for streaming broadcasts
  addSessionClient(sessionName, ws);
  cacheSessionFile(sessionName);

  // Send reset so client reloads all messages fresh on every connect/reconnect
  sendWs(ws, { type: 'reset' });

  async function emitNewLines() {
    const stats = await fsp.stat(filePath);
    if (stats.size < offset) {
      offset = 0;
      remainder = '';
      sendWs(ws, { type: 'reset' });
    }

    if (stats.size <= offset) {
      return;
    }

    let chunk = '';
    await new Promise((resolve, reject) => {
      const reader = fs.createReadStream(filePath, {
        start: offset,
        end: stats.size - 1,
        encoding: 'utf8',
      });

      reader.on('data', (part) => {
        chunk += part;
      });
      reader.on('error', reject);
      reader.on('end', resolve);
    });

    offset = stats.size;
    const combined = remainder + chunk;
    const lines = combined.split(/\r?\n/);
    remainder = lines.pop() || '';

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const parsed = safeJsonParse(line, filePath, 0);
      if (!parsed) continue;
      sendWs(ws, { type: 'line', record: parsed });
    }
  }

  async function pollForChanges() {
    if (reading) {
      rerun = true;
      return;
    }

    reading = true;
    try {
      do {
        rerun = false;
        await emitNewLines();
      } while (rerun);
    } catch (error) {
      sendWs(ws, { type: 'error', error: error.message });
    } finally {
      reading = false;
    }
  }

  watcher = fs.watch(filePath, () => {
    pollForChanges();
  });

  ws.on('close', () => {
    removeSessionClient(sessionName, ws);
    if (watcher) {
      watcher.close();
    }
  });
}

server.on('upgrade', (req, socket, head) => {
  const sessionName = parseSessionNameFromUpgrade(req);
  if (!sessionName) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, sessionName);
  });
});

wss.on('connection', (ws, req, sessionName) => {
  setupSessionStream(ws, sessionName).catch((error) => {
    sendWs(ws, { type: 'error', error: error.message });
    ws.close(1011, 'Stream setup failed');
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`OpenClaw Log Viewer running on http://localhost:${PORT}`);
  // Connect to Gateway for live streaming
  connectToGateway();
});
