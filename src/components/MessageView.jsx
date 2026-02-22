import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtCost, fmtDate, fmtNum, pretty, splitMessageContent } from '@/lib/format';

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
    ? 'bg-blue-600/20 border-blue-500/40 text-blue-50'
    : isAssistant
      ? 'bg-slate-800/70 border-slate-700 text-slate-100'
      : 'bg-slate-900/80 border-slate-700 text-slate-300';

  const { text, thinking, toolCalls } = splitMessageContent(message);
  const toolResultText =
    role === 'toolResult'
      ? (Array.isArray(message.content) ? message.content : [])
          .map((item) => item?.text || '')
          .join('\n')
      : '';

  return (
    <div className={`flex ${side}`}>
      <div
        className={`max-w-[92%] rounded-xl border px-4 py-3 shadow-sm transition hover:border-slate-600/80 ${box}`}
      >
        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="uppercase tracking-wide">{role}</span>
          {usagePill(message)}
          <span>{fmtDate(message.timestamp)}</span>
        </div>

        {text ? <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">{text}</pre> : null}

        {toolResultText ? (
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-emerald-200">
            {toolResultText}
          </pre>
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

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !stickToBottom) return;
    node.scrollTop = node.scrollHeight;
  }, [stickToBottom, filteredMessages.length, events.length]);

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
    <div ref={scrollRef} onScroll={onScroll} className="h-full min-h-[68vh] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/60">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded border border-slate-700 px-2 py-1">{sessionData.session.name}</span>
          <span>{fmtNum(filteredMessages.length)} messages</span>
          {sessionData.parseErrors?.length ? (
            <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-300">
              {sessionData.parseErrors.length} parse errors
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {events.map((event, idx) => (
            <div
              key={`${event.type || 'event'}-${event.timestamp || idx}`}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-500"
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
