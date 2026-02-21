const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const app = express();
const PORT = 3099;

const SESSIONS_DIR = '/home/ubuntu/.openclaw/agents/main/sessions';
const COMMANDS_LOG = '/home/ubuntu/.openclaw/logs/commands.log';
const CONFIG_AUDIT_LOG = '/home/ubuntu/.openclaw/logs/config-audit.jsonl';
const CRON_RUNS_DIR = '/home/ubuntu/.openclaw/cron/runs';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

async function listSessionFiles() {
  const entries = await fsp.readdir(SESSIONS_DIR, { withFileTypes: true });
  const sessionFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.includes('.jsonl'));

  const withMeta = await Promise.all(
    sessionFiles.map(async (name) => {
      const fullPath = path.join(SESSIONS_DIR, name);
      const stats = await fsp.stat(fullPath);
      return getSessionMeta(name, stats);
    })
  );

  return withMeta.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

async function parseSessionFileByName(fileName) {
  const available = await listSessionFiles();
  const found = available.find((s) => s.name === fileName);

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
    parseErrors: records.filter((r) => r && r._parseError),
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
      activeSessions: sessions.filter((s) => !s.isArchived).length,
      archivedSessions: sessions.filter((s) => s.isArchived).length,
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OpenClaw Log Viewer running on http://localhost:${PORT}`);
});
