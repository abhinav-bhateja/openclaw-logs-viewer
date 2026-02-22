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
    blocks.push({
      type: 'code',
      language: match[1] || '',
      content: match[2] || '',
    });
    last = fenceRegex.lastIndex;
  }

  if (last < source.length) {
    blocks.push({ type: 'text', content: source.slice(last) });
  }

  return blocks.length ? blocks : [{ type: 'text', content: source }];
}

function renderInlineCode(text, keyPrefix) {
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

    return (
      <span key={`${keyPrefix}-text-${index}`} className="whitespace-pre-wrap break-words">
        {part}
      </span>
    );
  });
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
            {renderInlineCode(block.content, `${prefix}-block-${index}`)}
          </p>
        );
      })}
    </div>
  );
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

function MessageBubble({ message }) {
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
          <span className="uppercase tracking-wide">{role}</span>
          {usagePill(message)}
          <span>{fmtDate(message.timestamp)}</span>
        </div>

        {text ? <MarkdownMessage text={text} prefix={`${message.id || message.timestamp}-msg`} /> : null}

        {toolResultText ? (
          <MarkdownMessage
            text={toolResultText}
            prefix={`${message.id || message.timestamp}-tool-result`}
            className="mt-2 text-emerald-200"
          />
        ) : null}

        {thinking.map((block, index) => (
          <details key={`${message.id || message.timestamp}-thinking-${index}`} className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2">
            <summary className="cursor-pointer text-xs text-amber-200">Thinking block {index + 1}</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-amber-100">{block}</pre>
          </details>
        ))}

        {toolCalls.map((call, index) => (
          <details key={`${message.id || message.timestamp}-tool-${index}`} className="mt-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-2">
            <summary className="cursor-pointer text-xs text-cyan-200">
              Tool call {index + 1}: {call.name || 'unknown'}
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-cyan-100">{pretty(call.arguments)}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}

export default function MessageView({ sessionData, filter }) {
  const scrollRef = useRef(null);
  const [stickToBottom, setStickToBottom] = useState(true);

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
    setStickToBottom(distance < 56);
  }

  if (!sessionData) {
    return (
      <div className="grid h-full min-h-[68vh] place-items-center text-sm text-slate-500">
        Select a session to inspect messages
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="h-full min-h-[68vh] overflow-auto">
      <div className="space-y-3 px-1 py-1 sm:px-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="border border-slate-700 px-2 py-1">{sessionData.session.name}</span>
          <span>{fmtNum(filteredMessages.length)} messages</span>
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
              <MessageBubble key={`${message.id || message.timestamp || 'msg'}-${index}`} message={message} />
            ))
          ) : (
            <div className="text-sm text-slate-500">No messages</div>
          )}
        </div>
      </div>
    </div>
  );
}
