import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Skeleton from '@/components/Skeleton';
import { useTicker } from '@/hooks/useTicker';
import { fmtCost, fmtDate, fmtDateFull, fmtNum, pretty, splitMessageContent } from '@/lib/format';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { parseUserMessage } from '@/lib/parseUserMessage';
import { getToolSummary, looksLikeJson, highlightJson } from '@/lib/toolCallRenderer';

/* ── Helpers ── */

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function applyHighlight(children, query) {
  if (!query) return children;
  if (typeof children === 'string') return highlightText(children, query);
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === 'string' ? <span key={i}>{highlightText(child, query)}</span> : child
    );
  }
  return children;
}

function highlightText(text, query) {
  if (!query || !text) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="rounded bg-yellow-400/30 text-yellow-200 px-0.5">{part}</mark>
      : part
  );
}

/* ── Code Block ── */

function CodeBlock({ content, language }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950">
      {language && (
        <div className="border-b border-slate-800 px-3 py-1 text-[10px] text-slate-500">{language}</div>
      )}
      <pre className="no-scrollbar overflow-x-auto px-3 py-2 text-xs text-slate-100">
        <code className="font-mono">{content}</code>
      </pre>
      <button type="button" onClick={copy}
        className="absolute right-2 top-2 rounded border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[10px] text-slate-400 opacity-0 transition duration-100 group-hover:opacity-100 hover:text-slate-200">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

/* ── Markdown Renderer ── */

function MarkdownMessage({ text, className = '', searchQuery = '' }) {
  return (
    <div className={`prose-md text-sm leading-relaxed ${className}`.trim()}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}
        components={{
          pre({ children }) {
            const codeEl = children?.props;
            const lang = (codeEl?.className || '').replace('language-', '').replace('hljs ', '') || '';
            const t = typeof codeEl?.children === 'string' ? codeEl.children : '';
            return <CodeBlock content={t} language={lang} />;
          },
          code({ className, children, ...props }) {
            if (className) return <code className={className} {...props}>{children}</code>;
            return (
              <code className="rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-[0.85em] text-pink-300/90 border border-slate-700/50" {...props}>
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline decoration-blue-400/30 hover:text-blue-300 hover:decoration-blue-300/50">{children}</a>;
          },
          table({ children }) {
            return <div className="overflow-x-auto my-2"><table className="min-w-full text-xs border-collapse border border-slate-700">{children}</table></div>;
          },
          th({ children }) { return <th className="border border-slate-700 bg-slate-800/60 px-2 py-1 text-left text-slate-300">{children}</th>; },
          td({ children }) { return <td className="border border-slate-700/60 px-2 py-1 text-slate-300">{children}</td>; },
          ul({ children }) { return <ul className="list-disc pl-5 space-y-0.5 my-1">{children}</ul>; },
          ol({ children }) { return <ol className="list-decimal pl-5 space-y-0.5 my-1">{children}</ol>; },
          blockquote({ children }) { return <blockquote className="border-l-2 border-slate-600 pl-3 text-slate-400 italic my-2">{children}</blockquote>; },
          h1({ children }) { return <h1 className="text-lg font-semibold text-slate-100 mt-3 mb-1">{children}</h1>; },
          h2({ children }) { return <h2 className="text-base font-semibold text-slate-100 mt-3 mb-1">{children}</h2>; },
          h3({ children }) { return <h3 className="text-sm font-semibold text-slate-100 mt-2 mb-1">{children}</h3>; },
          p({ children }) { return <p className="whitespace-pre-wrap break-words my-1">{applyHighlight(children, searchQuery)}</p>; },
        }}>
        {text}
      </Markdown>
    </div>
  );
}

/* ── Collapsible ── */

function Collapsible({ open, children }) {
  return (
    <div className="collapsible-grid" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

const COLLAPSE_LINES = 6;

function CollapsibleText({ text, className = '', mono = false }) {
  const [expanded, setExpanded] = useState(false);
  const lines = (text || '').split('\n');
  const needsCollapse = lines.length > COLLAPSE_LINES;
  const visible = needsCollapse && !expanded ? lines.slice(0, COLLAPSE_LINES).join('\n') : text;
  return (
    <div>
      <pre className={`whitespace-pre-wrap break-words text-xs ${mono ? 'font-mono' : 'font-sans'} ${className}`}>
        {visible}{needsCollapse && !expanded ? '...' : ''}
      </pre>
      {needsCollapse && (
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="mt-1 text-[11px] text-slate-400 underline hover:text-slate-200">
          {expanded ? `Collapse (${lines.length} lines)` : `Show full (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

/* ── Tool Result Preview ── */

function ToolResultPreview({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isJson = looksLikeJson(text);
  const lines = text.split('\n');

  if (isJson) {
    const highlighted = highlightJson(text);
    const jsonLines = highlighted.split('\n');
    const jsonHasMore = jsonLines.length > 4;
    const jsonExtra = jsonLines.length - 4;
    return (
      <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-950/80 p-2">
        <pre className="whitespace-pre-wrap break-words text-xs font-mono leading-relaxed text-slate-300"
          dangerouslySetInnerHTML={{ __html: !jsonHasMore || expanded ? highlighted : jsonLines.slice(0, 4).join('\n') }} />
        {jsonHasMore && (
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="mt-1 text-[10px] text-slate-500 hover:text-slate-300 transition duration-100">
            {expanded ? 'collapse' : `+${jsonExtra} more lines`}
          </button>
        )}
      </div>
    );
  }

  const hasMore = lines.length > 3;
  if (!hasMore) return <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-300 font-mono leading-relaxed">{text}</pre>;

  return (
    <div className="mt-2">
      <pre className="whitespace-pre-wrap break-words text-xs text-slate-300 font-mono leading-relaxed">{lines.slice(0, 3).join('\n')}</pre>
      <Collapsible open={expanded}>
        <pre className="whitespace-pre-wrap break-words text-xs text-slate-300 font-mono leading-relaxed">{lines.slice(3).join('\n')}</pre>
      </Collapsible>
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="mt-1 text-[10px] text-slate-500 hover:text-slate-300 transition duration-100">
        {expanded ? 'collapse' : `+${lines.length - 3} more lines`}
      </button>
    </div>
  );
}

/* ── Avatar ── */

const ROLE_COLORS = {
  user: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  assistant: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  system: 'bg-slate-800/50 text-slate-400 border-slate-700/40',
  tool: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  toolResult: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const ROLE_ICONS = {
  user: '👤',
  assistant: '🤖',
  system: '⚙️',
  tool: '🔧',
  toolResult: '🔧',
};

const ROLE_LABELS = {
  user: 'You',
  assistant: 'Stark',
  system: 'System',
  tool: 'Tool',
  toolResult: 'Tool result',
};

function Avatar({ role }) {
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm ${ROLE_COLORS[role] || ROLE_COLORS.system}`}>
      {ROLE_ICONS[role] || '⚙️'}
    </div>
  );
}

function roleLabel(role) { return ROLE_LABELS[role] || role; }

/* ── Usage Pill ── */

function usagePill(message) {
  const usage = message?.usage || {};
  const tokens = usage.totalTokens || usage.total_tokens;
  const totalCost = message?.usage?.cost?.total;
  if (!tokens && !totalCost) return null;
  return (
    <span className="inline-flex rounded-full border border-slate-700/50 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400 tabular-nums">
      {fmtNum(tokens)} tok{totalCost ? ` · ${fmtCost(totalCost)}` : ''}
    </span>
  );
}

/* ── Copy Button ── */

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }
  return (
    <button type="button" onClick={copy}
      className="rounded border border-slate-700/50 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-500 opacity-0 transition duration-100 group-hover:opacity-100 hover:text-slate-300">
      {copied ? '✓' : 'Copy'}
    </button>
  );
}

/* ── Slack-style Message ── */

function SlackMessage({ message, isGrouped, isLastMessage, displayOptions, searchQuery }) {
  const role = message.role || 'unknown';
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';
  const isSystem = role === 'system';

  const { text: rawText, thinking, toolCalls } = splitMessageContent(message);
  const parsed = isUser ? parseUserMessage(message.content) : null;
  const text = parsed ? parsed.text : rawText;
  const senderName = parsed?.sender || roleLabel(role);
  const toolResultText = role === 'toolResult'
    ? (Array.isArray(message.content) ? message.content : []).map(item => item?.text || '').join('\n')
    : '';
  const toolResultName = role === 'toolResult'
    ? (Array.isArray(message.content) ? message.content : []).find(item => item?.toolName)?.toolName
    : null;

  const [thinkingOpen, setThinkingOpen] = useState(() =>
    thinking.map((_, i) => isLastMessage && i === thinking.length - 1));
  const [toolCallsOpen, setToolCallsOpen] = useState(() => toolCalls.map(() => false));
  const toggleThinking = idx => setThinkingOpen(prev => prev.map((v, i) => i === idx ? !v : v));
  const toggleToolCall = idx => setToolCallsOpen(prev => prev.map((v, i) => i === idx ? !v : v));

  const copyText = text || toolResultText || '';

  // System messages: inline divider style
  if (isSystem) {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-slate-800/60" />
        <span className="max-w-[80%] text-center text-[11px] text-slate-500 italic">
          {text ? highlightText(text.slice(0, 200), searchQuery) : 'system'}
        </span>
        <div className="h-px flex-1 bg-slate-800/60" />
      </div>
    );
  }

  return (
    <div className={`group flex gap-3 rounded-md px-3 py-1 transition duration-75 hover:bg-slate-800/30 ${isGrouped ? '' : 'mt-3'}`}>
      {/* Avatar or spacer */}
      <div className="w-8 shrink-0 pt-0.5">
        {!isGrouped && <Avatar role={role} />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header: name + timestamp (only for first in group) */}
        {!isGrouped && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className={`text-sm font-semibold ${isUser ? 'text-blue-300' : isAssistant ? 'text-emerald-300' : 'text-purple-300'}`}>
              {senderName}
            </span>
            {usagePill(message)}
            <span className="text-[11px] text-slate-500 tabular-nums" title={fmtDateFull(message.timestamp)}>
              {relativeTime(message.timestamp)}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {copyText && <CopyButton text={copyText} />}
            </div>
          </div>
        )}

        {/* Grouped message timestamp on hover */}
        {isGrouped && (
          <div className="float-left -ml-11 w-8 pt-1 text-center">
            <span className="hidden text-[9px] text-slate-600 tabular-nums group-hover:inline" title={fmtDateFull(message.timestamp)}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Tool result badge */}
        {toolResultName && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[11px] font-medium text-purple-300">
            🔧 {toolResultName}
          </div>
        )}

        {/* Message body */}
        {text && <MarkdownMessage text={text} className="text-slate-200" searchQuery={searchQuery} />}

        {/* Tool result */}
        {toolResultText && <ToolResultPreview text={toolResultText} />}

        {/* Thinking blocks */}
        {displayOptions?.showThinking !== false && thinking.map((block, index) => {
          const isOpen = thinkingOpen[index] ?? false;
          return (
            <div key={`thinking-${index}`} className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-2">
              <button type="button" onClick={() => toggleThinking(index)}
                className="flex w-full items-center gap-1.5 text-xs text-amber-200/80 hover:text-amber-100 transition duration-100">
                <span className="text-[10px] transition-transform duration-150" style={{ display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                <span>💭 Thinking</span>
                <span className="text-[10px] text-amber-300/50">{fmtNum(block.length)} chars</span>
              </button>
              <Collapsible open={isOpen}>
                <CollapsibleText text={block} className="mt-2 text-amber-100/90" />
              </Collapsible>
            </div>
          );
        })}

        {/* Tool calls */}
        {displayOptions?.showToolUse !== false && toolCalls.map((call, index) => {
          const isOpen = toolCallsOpen[index] ?? false;
          const argsText = pretty(call.arguments);
          const summary = getToolSummary(call.name, call.arguments);
          const isExec = call.name === 'exec';
          const isProcess = call.name === 'process';
          return (
            <div key={`tool-${index}`} className="mt-2 rounded-lg border border-blue-400/15 bg-blue-400/5 p-2">
              <button type="button" onClick={() => toggleToolCall(index)}
                className="flex w-full items-center gap-1.5 text-xs text-blue-300/80 hover:text-blue-200 transition duration-100">
                <span className="text-[10px] transition-transform duration-150" style={{ display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                <span className="text-sm">{summary.icon}</span>
                <span className="font-medium">{summary.label}</span>
              </button>
              {!isOpen && isExec && summary.detail && (
                <div className="mt-1.5 rounded-md border border-slate-700/60 bg-slate-950/80 px-3 py-1.5">
                  <pre className="text-[11px] font-mono text-green-300/80 leading-relaxed whitespace-pre-wrap break-all">
                    <span className="text-slate-500 select-none">$ </span>{summary.detail}
                  </pre>
                </div>
              )}
              {!isOpen && isProcess && summary.detail && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-600/40 bg-slate-800/60 px-2.5 py-0.5 text-[11px] text-slate-400">
                  {summary.detail}
                </div>
              )}
              {!isOpen && !isExec && !isProcess && summary.detail && (
                <pre className="mt-1 text-[11px] text-blue-200/50 font-mono truncate leading-tight">{summary.detail}</pre>
              )}
              <Collapsible open={isOpen}>
                <CollapsibleText text={argsText} className="mt-2 text-blue-100/80" mono />
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Streaming Indicator ── */

function StreamingBubble({ text }) {
  return (
    <div className="group flex gap-3 px-3 py-1 mt-3">
      <div className="w-8 shrink-0 pt-0.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-purple-500/20 text-purple-300 border-purple-500/30 text-sm streaming-pulse">
          🤖
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-purple-300">Stark</span>
          <span className="flex items-center gap-1.5 text-[11px] text-purple-300/60">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-purple-400 opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
            </span>
            typing...
          </span>
        </div>
        {text ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
            {text}<span className="inline-block h-4 w-0.5 animate-pulse bg-purple-400/70 align-text-bottom" />
          </div>
        ) : (
          <div className="flex items-center gap-1 py-1">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400/60" style={{ animationDelay: '0ms' }} />
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400/60" style={{ animationDelay: '300ms' }} />
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400/60" style={{ animationDelay: '600ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── System Event Divider ── */

function SystemEventDivider({ event }) {
  let label = null;
  if (event.type === 'thinking_level_change') {
    label = `Thinking: ${event.thinkingLevel || event.level || '?'}`;
  } else if (event.type === 'model_change' || (event.type === 'custom' && event.customType === 'model-snapshot')) {
    const model = event.modelId || event.model || event.data?.modelId || event.data?.model;
    if (model) label = `Model: ${model}`;
  } else {
    label = event.type?.replace(/_/g, ' ');
  }
  if (!label) return null;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="h-px flex-1 bg-slate-800/50" />
      <span className="text-[10px] text-slate-600">{label}</span>
      <div className="h-px flex-1 bg-slate-800/50" />
    </div>
  );
}

/* ── Stat Pill ── */

function StatPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700/60 bg-slate-800/40 px-2.5 py-0.5 text-[11px] text-slate-300 tabular-nums">
      {children}
    </span>
  );
}

/* ── Main Component ── */

export default function MessageView({ sessionData, filter, onRefresh, wsConnected, wsReconnecting, streamingText, isStreaming, displayOptions, onDisplayOptionsChange, isLoading = false }) {
  useTicker(30_000);
  const scrollRef = useRef(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showFloating, setShowFloating] = useState(false);

  const searchQuery = filter.trim().toLowerCase();

  const filteredMessages = useMemo(() => {
    const source = sessionData?.messages || [];
    if (!searchQuery) return source;
    return source.filter(message => JSON.stringify(message).toLowerCase().includes(searchQuery));
  }, [searchQuery, sessionData?.messages]);

  const matchCount = searchQuery ? filteredMessages.length : 0;
  const events = sessionData?.events || [];
  const messageCount = sessionData?.messages?.length || 0;
  const eventCount = sessionData?.events?.length || 0;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    setStickToBottom(true);
    requestAnimationFrame(() => { node.scrollTop = node.scrollHeight; });
  }, [sessionData?.session?.name]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !stickToBottom) return;
    requestAnimationFrame(() => { node.scrollTop = node.scrollHeight; });
  }, [stickToBottom, messageCount, eventCount, streamingText, isStreaming]);

  const onScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distance < 56;
    setStickToBottom(atBottom);
    setShowFloating(!atBottom);
  }, []);

  function jumpToBottom() {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    setStickToBottom(true);
    setShowFloating(false);
  }

  if (isLoading && !sessionData) {
    return <div className="flex min-h-0 flex-1 flex-col p-3"><Skeleton /></div>;
  }

  if (!sessionData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm font-medium text-slate-400">No session selected</p>
        <p className="text-xs text-slate-600">Pick a session from the sidebar to start reading</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-800/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 truncate text-sm font-semibold text-slate-200" title={sessionData.session.name}>
            # {sessionData.session.label || sessionData.session.sessionId.slice(0, 8)}
          </h2>
          <span className="hidden text-[11px] text-slate-500 sm:inline">{fmtNum(filteredMessages.length)} msgs</span>

          {searchQuery && (
            <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] text-yellow-300 ring-1 ring-yellow-400/30">
              {matchCount} of {messageCount}
            </span>
          )}

          {wsConnected && (
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="hidden sm:inline">Live</span>
            </span>
          )}
          {!wsConnected && sessionData?.session?.name && (
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
            </span>
          )}

          {sessionData.parseErrors?.length ? (
            <span className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
              {sessionData.parseErrors.length} err
            </span>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button type="button"
              onClick={() => onDisplayOptionsChange?.({ ...displayOptions, showThinking: !displayOptions?.showThinking })}
              className={`rounded-full px-2 py-0.5 text-[10px] transition duration-100 sm:text-[11px] sm:px-2.5 ${
                displayOptions?.showThinking ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30' : 'text-slate-500 hover:text-slate-300'
              }`}>💭</button>
            <button type="button"
              onClick={() => onDisplayOptionsChange?.({ ...displayOptions, showToolUse: !displayOptions?.showToolUse })}
              className={`rounded-full px-2 py-0.5 text-[10px] transition duration-100 sm:text-[11px] sm:px-2.5 ${
                displayOptions?.showToolUse ? 'bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/30' : 'text-slate-500 hover:text-slate-300'
              }`}>🔧</button>
            <a href={`/api/sessions/${sessionData.session?.name}/export?showThinking=${displayOptions?.showThinking ?? false}&showToolUse=${displayOptions?.showToolUse ?? true}`}
              download className="hidden rounded-full px-2.5 py-0.5 text-[11px] text-slate-500 transition duration-100 hover:text-slate-300 hover:bg-slate-800/60 sm:inline-block"
              title="Export as Markdown">↓ Export</a>
          </div>
        </div>

        {/* Stat pills */}
        <div className="mt-1 hidden flex-wrap items-center gap-1.5 sm:flex">
          {sessionData.summary?.duration && <StatPill>{sessionData.summary.duration}</StatPill>}
          {sessionData.summary?.totalTokens > 0 && <StatPill>{fmtNum(sessionData.summary.totalTokens)} tok</StatPill>}
          {sessionData.summary?.totalCost > 0 && <StatPill>{fmtCost(sessionData.summary.totalCost)}</StatPill>}
          {sessionData.summary?.models?.length > 0 && (
            <StatPill><span className="truncate max-w-[180px]">{sessionData.summary.models.join(', ')}</span></StatPill>
          )}
        </div>
      </div>

      {/* Messages — Slack-style */}
      <div ref={scrollRef} onScroll={onScroll} className="no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="py-3">
          {filteredMessages.length ? (
            filteredMessages.map((message, index) => {
              const prev = index > 0 ? filteredMessages[index - 1] : null;
              const isGrouped = prev
                && prev.role === message.role
                && (new Date(message.timestamp) - new Date(prev.timestamp)) < 120_000; // 2 min grouping

              const msgTime = new Date(message.timestamp).getTime();
              const eventsBefore = events.filter(e => {
                const eTime = new Date(e.timestamp).getTime();
                const prevTime = index > 0 ? new Date(filteredMessages[index - 1].timestamp).getTime() : 0;
                return eTime > prevTime && eTime <= msgTime;
              });

              return (
                <div key={`${message.id || message.timestamp || 'msg'}-${index}`}>
                  {eventsBefore.map((evt, ei) => (
                    <SystemEventDivider key={`evt-${index}-${ei}`} event={evt} />
                  ))}
                  <SlackMessage
                    message={message}
                    isGrouped={isGrouped}
                    isLastMessage={!isStreaming && index === filteredMessages.length - 1}
                    displayOptions={displayOptions}
                    searchQuery={searchQuery}
                  />
                </div>
              );
            })
          ) : (
            <div className="px-4 text-sm text-slate-500">
              {searchQuery ? `No messages matching "${filter}"` : 'No messages'}
            </div>
          )}
          {isStreaming && <StreamingBubble text={streamingText} />}
        </div>
      </div>

      {/* Floating buttons */}
      {showFloating && (
        <div className="absolute bottom-3 right-3 flex gap-2">
          {onRefresh && (
            <button type="button" onClick={onRefresh}
              className="rounded-xl border border-blue-500/35 bg-blue-600/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur transition duration-100 hover:bg-blue-500">
              ↻ Refetch
            </button>
          )}
          <button type="button" onClick={jumpToBottom}
            className="rounded-xl border border-slate-600 bg-slate-800/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur transition duration-100 hover:bg-slate-700">
            ↓ Bottom
          </button>
        </div>
      )}
    </div>
  );
}
