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
});
