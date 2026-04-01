/**
 * Enhanced tool call rendering utilities
 * Extracts meaningful info from tool calls and provides display hints
 */

const TOOL_ICONS = {
  exec: '⚡',
  process: '⏳',
  read: '📄',
  edit: '✏️',
  write: '📝',
  web_search: '🔍',
  web_fetch: '🌐',
  message: '💬',
  cron: '⏰',
  browser: '🖥️',
  memory_search: '🧠',
  memory_get: '🧠',
  image_generate: '🎨',
  gateway: '⚙️',
  tts: '🔊',
  pdf: '📑',
  sessions_spawn: '🚀',
  sessions_send: '📨',
  subagents: '🤖',
};

/**
 * Parse tool call arguments (handles string or object)
 */
function parseArgs(args) {
  if (!args) return {};
  if (typeof args === 'object') return args;
  try { return JSON.parse(args); } catch { return {}; }
}

/**
 * Get a human-friendly summary for a tool call
 */
export function getToolSummary(name, args) {
  const a = parseArgs(args);
  const icon = TOOL_ICONS[name] || '🔧';

  switch (name) {
    case 'exec':
      return { icon, label: 'exec', detail: a.command || '', type: 'command' };
    case 'process':
      if (a.action === 'poll')
        return { icon, label: 'process', detail: `polling ${a.sessionId || '?'} (${Math.round((a.timeout || 0) / 1000)}s)`, type: 'status' };
      if (a.action === 'log')
        return { icon, label: 'process', detail: `logs ${a.sessionId || '?'} (last ${a.limit || '?'})`, type: 'status' };
      if (a.action === 'kill')
        return { icon, label: 'process', detail: `kill ${a.sessionId || '?'}`, type: 'status' };
      return { icon, label: 'process', detail: `${a.action || '?'} ${a.sessionId || ''}`.trim(), type: 'status' };
    case 'read':
      return { icon, label: 'read', detail: a.path || a.file || a.filePath || a.file_path || '', type: 'path' };
    case 'edit':
      return { icon, label: 'edit', detail: a.path || a.file || a.filePath || a.file_path || '', type: 'path' };
    case 'write':
      return { icon, label: 'write', detail: a.path || a.file || a.filePath || a.file_path || '', type: 'path' };
    case 'web_search':
      return { icon, label: 'search', detail: a.query || '', type: 'query' };
    case 'web_fetch':
      return { icon, label: 'fetch', detail: a.url || '', type: 'url' };
    case 'message':
      return { icon, label: 'message', detail: `${a.action || '?'}${a.target ? ' → ' + a.target : ''}`, type: 'status' };
    case 'cron':
      return { icon, label: 'cron', detail: `${a.action || '?'}${a.job?.name ? ' "' + a.job.name + '"' : ''}${a.jobId ? ' ' + a.jobId.slice(0, 8) : ''}`, type: 'status' };
    case 'browser':
      return { icon, label: 'browser', detail: a.action || '', type: 'status' };
    case 'memory_search':
      return { icon, label: 'memory', detail: a.query || '', type: 'query' };
    case 'memory_get':
      return { icon, label: 'memory', detail: a.path || '', type: 'path' };
    case 'gateway':
      return { icon, label: 'gateway', detail: a.action || '', type: 'status' };
    case 'sessions_spawn':
      return { icon, label: 'spawn', detail: a.task ? a.task.slice(0, 80) : '', type: 'status' };
    default:
      return { icon, label: name || 'tool', detail: '', type: 'generic' };
  }
}

/**
 * Check if a string looks like JSON
 */
export function looksLikeJson(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

/**
 * Syntax-highlight JSON string with CSS classes
 */
export function highlightJson(jsonStr) {
  try {
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    const pretty = JSON.stringify(obj, null, 2);
    return pretty
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // strings (but not keys)
      .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
        // Check if this is a key (followed by :)
        return match;
      })
      // Better approach: line by line
      .split('\n')
      .map(line => {
        // Key-value lines
        return line
          .replace(/^(\s*)"([^"]+)"(:)/, '$1<span class="json-key">"$2"</span>$3')
          .replace(/: "([^"\\]*(\\.[^"\\]*)*)"(,?)$/, ': <span class="json-string">"$1"</span>$3')
          .replace(/: (-?\d+\.?\d*)(,?)$/, ': <span class="json-number">$1</span>$2')
          .replace(/: (true|false)(,?)$/, ': <span class="json-bool">$1</span>$2')
          .replace(/: (null)(,?)$/, ': <span class="json-null">$1</span>$2');
      })
      .join('\n');
  } catch {
    return jsonStr;
  }
}
