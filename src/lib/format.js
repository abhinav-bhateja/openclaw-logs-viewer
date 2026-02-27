export function fmtDate(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  const now = Date.now();
  const diff = now - dt.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtDateFull(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString();
}

export function fmtCost(n) {
  return `$${Number(n || 0).toFixed(4)}`;
}

export function pretty(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function splitMessageContent(message) {
  const content = Array.isArray(message?.content) ? message.content : [];
  const textBits = [];
  const thinking = [];
  const toolCalls = [];

  for (const item of content) {
    if (item?.type === 'text') textBits.push(item.text || '');
    if (item?.type === 'thinking') thinking.push(item.thinking || '');
    if (item?.type === 'toolCall') toolCalls.push(item);
  }

  return { text: textBits.join('\n'), thinking, toolCalls };
}

export function mapMessageRecord(record) {
  return {
    id: record.id,
    parentId: record.parentId,
    timestamp: record.timestamp,
    ...record.message,
  };
}
