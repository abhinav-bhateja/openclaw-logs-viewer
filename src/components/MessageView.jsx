import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtCost, fmtDate, fmtNum, pretty, splitMessageContent } from '@/lib/format';

function parseMarkdownCode(text) {
  const source = text || '';
  const blocks = [];
  const fenceRegex = /```([\w-]+)?\n?([\s\S]*?)```/g;
  let last = 0;
  let match;

  while ((match = fenceRegex.exec(source)) !== null) {
    if (match.index > last) {
      blocks.push({ type: 'text', content: source.slice(last, match.index) });
    }
    blocks.push({ type: 'code', language: match[1] || '', content: match[2] || '' });
    last = fenceRegex.lastIndex;
  }

  if (last < source.length) {
    blocks.push({ type: 'text', content: source.slice(last) });
  }

  return blocks.length ? blocks : [{ type: 'text', content: source }];
}

function renderInlineMarkdown(text, keyPrefix) {
  // Split on inline code first, then handle bold/italic in text segments
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <code
          key={`${keyPrefix}-inline-${index}`}
          className="rounded border border-slate-600/70 bg-slate-900 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-100"
        >
          {part}
        </code>
      );
    }
    // Handle bold (**text**), italic (*text*), and links [text](url)
    const segments = [];
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\)]+)\))/g;
    let last = 0;
    let m;
    while ((m = re.exec(part)) !== null) {
      if (m.index > last) segments.push(<span key={`${keyPrefix}-t-${index}-${last}`} className="whitespace-pre-wrap break-words">{part.slice(last, m.index)}</span>);
      if (m[2]) segments.push(<strong key={`${keyPrefix}-b-${index}-${m.index}`} className="font-semibold text-slate-100">{m[2]}</strong>);
      else if (m[3]) segments.push(<em key={`${keyPrefix}-i-${index}-${m.index}`} className="italic text-slate-200">{m[3]}</em>);
      else if (m[4]) segments.push(<a key={`${keyPrefix}-a-${index}-${m.index}`} href={m[5]} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">{m[4]}</a>);
      last = re.lastIndex;
    }
    if (last < part.length) segments.push(<span key={`${keyPrefix}-t-${index}-${last}`} className="whitespace-pre-wrap break-words">{part.slice(last)}</span>);
    return segments.length ? segments : <span key={`${keyPrefix}-text-${index}`} className="whitespace-pre-wrap break-words">{part}</span>;
  });
}

function CodeBlock({ content, language }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="group relative overflow-hidden rounded-md border border-slate-700/80 bg-slate-950">
      {language && (
        <div className="border-b border-slate-800 px-3 py-1 text-[10px] text-slate-500">{language}</div>
      )}
      <pre className="no-scrollbar overflow-x-auto px-3 py-2 text-xs text-slate-100">
        <code className="font-mono">{content}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[10px] text-slate-400 opacity-0 transition duration-100 group-hover:opacity-100 hover:text-slate-200"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function MarkdownMessage({ text, prefix, className = '' }) {
  const blocks = parseMarkdownCode(text);
  return (
    <div className={`space-y-2 text-sm leading-6 ${className}`.trim()}>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <pre
              key={`${prefix}-code-${index}`}
              className="overflow-x-auto rounded-md border border-slate-700/80 bg-slate-950 px-3 py-2 text-xs text-slate-100"
            >
              <code className="font-mono">{block.content}</code>
            </pre>
          );
        }
        return (
          <p key={`${prefix}-text-${index}`} className="whitespace-pre-wrap break-words">
            {renderInlineMarkdown(block.content, `${prefix}-block-${index}`)}
          </p>
        );
      })}
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
        {visible}
        {needsCollapse && !expanded ? '…' : ''}
      </pre>
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] text-slate-400 underline hover:text-slate-200"
        >
          {expanded ? `Collapse (${lines.length} lines)` : `Show full (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

const ROLE_LABELS = {
  user: 'You',
  assistant: 'Stark',
  system: 'System',
  tool: 'Tool',
  toolResult: 'Tool result',
};

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function usagePill(message) {
  const usage = message?.usage || {};
  const tokens = usage.totalTokens || usage.total_tokens;
  const totalCost = message?.usage?.cost?.total;
  if (!tokens && !totalCost) return null;

  return (
    <span className="inline-flex rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[11px] text-slate-300">
      {fmtNum(tokens)} tok{totalCost ? ` • ${fmtCost(totalCost)}` : ''}
    </span>
  );
}

function MessageBubble({ message, isLastMessage }) {
  const role = message.role || 'unknown';
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';
  const isSystemLike = !isUser && !isAssistant;

  const side = isUser ? 'items-end' : isSystemLike ? 'items-center' : 'items-start';
  const box = isUser
    ? 'bg-blue-600/16 border-blue-500/35 text-blue-50'
    : isAssistant
      ? 'bg-slate-800/55 border-slate-700/80 text-slate-100'
      : 'bg-slate-900/70 border-slate-700/80 text-slate-300';

  const { text, thinking, toolCalls } = splitMessageContent(message);
  const toolResultText =
    role === 'toolResult'
      ? (Array.isArray(message.content) ? message.content : [])
          .map((item) => item?.text || '')
          .join('\n')
      : '';

  return (
    <div className={`flex ${side}`}>
      <div className={`max-w-[92%] rounded-lg border px-3 py-2.5 ${box}`}>
        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="font-medium uppercase tracking-wide">{roleLabel(role)}</span>
          {usagePill(message)}
          <span>{fmtDate(message.timestamp)}</span>
        </div>

        {text ? <MarkdownMessage text={text} prefix={`${message.id || message.timestamp}-msg`} /> : null}

        {toolResultText ? (
          <CollapsibleText
            text={toolResultText}
            className="mt-2 text-slate-300"
          />
        ) : null}

        {thinking.map((block, index) => {
          const isLast = isLastMessage && index === thinking.length - 1;
          return (
            <details
              key={`${message.id || message.timestamp}-thinking-${index}`}
              className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2"
              open={isLast}
            >
              <summary className="cursor-pointer text-xs text-amber-200">
                Thinking block {index + 1}
              </summary>
              <CollapsibleText text={block} className="mt-2 text-amber-100" />
            </details>
          );
        })}

        {toolCalls.map((call, index) => (
          <details
            key={`${message.id || message.timestamp}-tool-${index}`}
            className="mt-2 rounded-lg border border-blue-400/25 bg-blue-400/8 p-2"
          >
            <summary className="cursor-pointer text-xs text-blue-300">
              Tool: {call.name || 'unknown'}
            </summary>
            <CollapsibleText text={pretty(call.arguments)} className="mt-2 text-blue-100" mono />
          </details>
        ))}
      </div>
    </div>
  );
}

export default function MessageView({ sessionData, filter, onRefresh, wsConnected, wsReconnecting }) {
  const scrollRef = useRef(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showFloating, setShowFloating] = useState(false);

  const filteredMessages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const source = sessionData?.messages || [];
    if (!q) return source;
    return source.filter((message) => JSON.stringify(message).toLowerCase().includes(q));
  }, [filter, sessionData?.messages]);

  const events = sessionData?.events || [];
  const messageCount = sessionData?.messages?.length || 0;
  const eventCount = sessionData?.events?.length || 0;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    setStickToBottom(true);
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [sessionData?.session?.name]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !stickToBottom) return;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [stickToBottom, messageCount, eventCount]);

  function onScroll() {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distance < 56;
    setStickToBottom(atBottom);
    setShowFloating(!atBottom);
  }

  function jumpToBottom() {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    setStickToBottom(true);
    setShowFloating(false);
  }

  if (!sessionData) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-slate-500">
        Pick a session from the sidebar
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="no-scrollbar min-h-0 flex-1 overflow-auto">
        <div className="space-y-3 px-1 py-1 sm:px-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="border border-slate-700 px-2 py-1">{sessionData.session.name}</span>
            <span>{fmtNum(filteredMessages.length)} messages</span>
            {wsConnected && (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            )}
            {!wsConnected && wsReconnecting && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                Reconnecting...
              </span>
            )}
            {sessionData.parseErrors?.length ? (
              <span className="border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-300">
                {sessionData.parseErrors.length} parse errors
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {events.map((event, idx) => (
              <div
                key={`${event.type || 'event'}-${event.timestamp || idx}`}
                className="border border-slate-800 bg-slate-900/45 px-2 py-1 text-[11px] text-slate-500"
              >
                {event.type || 'event'} • {fmtDate(event.timestamp)}
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-1">
            {filteredMessages.length ? (
              filteredMessages.map((message, index) => (
                <MessageBubble
                  key={`${message.id || message.timestamp || 'msg'}-${index}`}
                  message={message}
                  isLastMessage={index === filteredMessages.length - 1}
                />
              ))
            ) : (
              <div className="text-sm text-slate-500">No messages</div>
            )}
          </div>
        </div>
      </div>

      {showFloating && (
        <div className="absolute bottom-3 right-3 flex gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-md border border-blue-500/35 bg-blue-600/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur transition duration-100 hover:bg-blue-500"
            >
              ⟳ Refetch
            </button>
          )}
          <button
            type="button"
            onClick={jumpToBottom}
            className="rounded-md border border-slate-600 bg-slate-800/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur transition duration-100 hover:bg-slate-700"
          >
            ↓ Bottom
          </button>
        </div>
      )}
    </div>
  );
}
