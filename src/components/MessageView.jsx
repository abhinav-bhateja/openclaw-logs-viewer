import { useEffect, useMemo, useRef, useState } from 'react';
import { useTicker } from '@/hooks/useTicker';
import { fmtCost, fmtDate, fmtDateFull, fmtNum, pretty, splitMessageContent } from '@/lib/format';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { parseUserMessage } from '@/lib/parseUserMessage';


function CodeBlock({ content, language }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950">
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

function MarkdownMessage({ text, className = '' }) {
  return (
    <div className={`prose-md text-sm leading-6 ${className}`.trim()}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre({ children }) {
            const codeEl = children?.props;
            const lang = (codeEl?.className || '').replace('language-', '').replace('hljs ', '') || '';
            const text = typeof codeEl?.children === 'string' ? codeEl.children : '';
            return <CodeBlock content={text} language={lang} />;
          },
          code({ className, children, ...props }) {
            if (className) return <code className={className} {...props}>{children}</code>;
            return (
              <code className="rounded border border-slate-600/70 bg-slate-900 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-100" {...props}>
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">{children}</a>;
          },
          table({ children }) {
            return <div className="overflow-x-auto my-2"><table className="min-w-full text-xs border-collapse border border-slate-700">{children}</table></div>;
          },
          th({ children }) {
            return <th className="border border-slate-700 bg-slate-800/60 px-2 py-1 text-left text-slate-300">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-slate-700/60 px-2 py-1 text-slate-300">{children}</td>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 space-y-0.5 my-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 space-y-0.5 my-1">{children}</ol>;
          },
          blockquote({ children }) {
            return <blockquote className="border-l-2 border-slate-600 pl-3 text-slate-400 italic my-2">{children}</blockquote>;
          },
          h1({ children }) { return <h1 className="text-lg font-semibold text-slate-100 mt-3 mb-1">{children}</h1>; },
          h2({ children }) { return <h2 className="text-base font-semibold text-slate-100 mt-3 mb-1">{children}</h2>; },
          h3({ children }) { return <h3 className="text-sm font-semibold text-slate-100 mt-2 mb-1">{children}</h3>; },
          p({ children }) { return <p className="whitespace-pre-wrap break-words my-1">{children}</p>; },
        }}
      >
        {text}
      </Markdown>
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
        {needsCollapse && !expanded ? '...' : ''}
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
      {fmtNum(tokens)} tok{totalCost ? ` \u00b7 ${fmtCost(totalCost)}` : ''}
    </span>
  );
}

function CopyMessageButton({ text }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="absolute right-2 top-2 rounded-lg border border-slate-600/60 bg-slate-800/90 px-2 py-0.5 text-[10px] text-slate-400 opacity-0 transition duration-150 group-hover:opacity-100 hover:text-slate-200 hover:bg-slate-700/90"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function Collapsible({ open, children }) {
  return (
    <div
      className="collapsible-grid"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function ToolResultPreview({ text }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  const preview = lines.slice(0, 3).join('\n');
  const hasMore = lines.length > 3;
  const extraCount = lines.length - 3;

  if (!hasMore) {
    return <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300 font-mono">{text}</pre>;
  }

  return (
    <div className="mt-2">
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300 font-mono">{preview}</pre>
      <Collapsible open={expanded}>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300 font-mono">{lines.slice(3).join('\n')}</pre>
      </Collapsible>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-[10px] text-slate-500 hover:text-slate-300 transition duration-100"
      >
        {expanded ? 'collapse' : `+${extraCount} more lines`}
      </button>
    </div>
  );
}

function Avatar({ role }) {
  const isUser = role === 'user';
  const letter = isUser ? 'U' : role === 'assistant' ? 'A' : 'S';
  const bg = isUser
    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    : role === 'assistant'
      ? 'bg-slate-700/50 text-slate-300 border-slate-600/40'
      : 'bg-slate-800/50 text-slate-400 border-slate-700/40';

  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${bg}`}>
      {letter}
    </div>
  );
}

function MessageBubble({ message, isLastMessage, displayOptions }) {
  const role = message.role || 'unknown';
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';
  const isSystemLike = !isUser && !isAssistant;

  const { text: rawText, thinking, toolCalls } = splitMessageContent(message);
  const parsed = isUser ? parseUserMessage(message.content) : null;
  const text = parsed ? parsed.text : rawText;
  const senderName = parsed?.sender;
  const toolResultText =
    role === 'toolResult'
      ? (Array.isArray(message.content) ? message.content : [])
          .map((item) => item?.text || '')
          .join('\n')
      : '';

  const toolResultName = role === 'toolResult'
    ? (Array.isArray(message.content) ? message.content : []).find((item) => item?.toolName)?.toolName
    : null;

  // Alignment and bubble styles
  const alignment = isUser ? 'justify-end' : isSystemLike ? 'justify-center' : 'justify-start';
  const maxWidth = isUser ? 'max-w-[75%]' : isAssistant ? 'max-w-[85%]' : 'max-w-[90%]';

  const bubbleStyle = isUser
    ? 'bg-blue-600/14 border-blue-500/25 text-blue-50 rounded-2xl rounded-tr-sm'
    : isAssistant
      ? 'bg-slate-800/40 border-slate-700/50 text-slate-100 rounded-2xl rounded-tl-sm'
      : 'bg-slate-900/50 border-slate-700/50 text-slate-300 rounded-xl';

  // Collapsible states for thinking blocks and tool calls
  const [thinkingOpen, setThinkingOpen] = useState(() =>
    thinking.map((_, i) => isLastMessage && i === thinking.length - 1)
  );
  const [toolCallsOpen, setToolCallsOpen] = useState(() =>
    toolCalls.map(() => false)
  );

  const toggleThinking = (idx) =>
    setThinkingOpen((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  const toggleToolCall = (idx) =>
    setToolCallsOpen((prev) => prev.map((v, i) => (i === idx ? !v : v)));

  const copyText = text || toolResultText || '';

  return (
    <div className={`flex ${alignment} gap-2.5`}>
      {!isUser && <Avatar role={role} />}
      <div className={`group relative ${maxWidth} border px-4 py-3 ${bubbleStyle}`}>
        {copyText && <CopyMessageButton text={copyText} />}

        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="font-medium uppercase tracking-wide">{senderName || roleLabel(role)}</span>
          {usagePill(message)}
          <span className="ml-auto shrink-0 tabular-nums" title={fmtDateFull(message.timestamp)}>{fmtDate(message.timestamp)}</span>
        </div>

        {toolResultName && (
          <div className="mb-1.5 inline-flex rounded-lg bg-slate-700/40 px-2 py-0.5 text-[11px] font-medium text-slate-300">
            {toolResultName}
          </div>
        )}

        {text ? <MarkdownMessage text={text} /> : null}

        {toolResultText ? (
          <ToolResultPreview text={toolResultText} />
        ) : null}

        {displayOptions?.showThinking !== false && thinking.map((block, index) => {
          const isOpen = thinkingOpen[index] ?? false;
          const charCount = block.length;
          return (
            <div key={`${message.id || message.timestamp}-thinking-${index}`} className="mt-2.5 rounded-xl border border-amber-400/20 bg-amber-400/6 p-2.5">
              <button
                type="button"
                onClick={() => toggleThinking(index)}
                className="flex w-full items-center gap-1.5 text-xs text-amber-200/80 hover:text-amber-100 transition duration-100"
              >
                <span className="text-[10px] transition-transform duration-150" style={{ display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
                <span>Thinking</span>
                <span className="text-[10px] text-amber-300/50">{fmtNum(charCount)} chars</span>
              </button>
              <Collapsible open={isOpen}>
                <CollapsibleText text={block} className="mt-2 text-amber-100/90" />
              </Collapsible>
            </div>
          );
        })}

        {displayOptions?.showToolUse !== false && toolCalls.map((call, index) => {
          const isOpen = toolCallsOpen[index] ?? false;
          const argsText = pretty(call.arguments);
          const argsPreview = argsText.split('\n').slice(0, 2).join('\n');
          return (
            <div key={`${message.id || message.timestamp}-tool-${index}`} className="mt-2.5 rounded-xl border border-blue-400/15 bg-blue-400/5 p-2.5">
              <button
                type="button"
                onClick={() => toggleToolCall(index)}
                className="flex w-full items-center gap-1.5 text-xs text-blue-300/80 hover:text-blue-200 transition duration-100"
              >
                <span className="text-[10px] transition-transform duration-150" style={{ display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
                <span className="font-medium">{call.name || 'unknown'}</span>
              </button>
              {!isOpen && argsPreview && (
                <pre className="mt-1 text-[11px] text-blue-200/40 font-mono truncate leading-tight">{argsPreview}</pre>
              )}
              <Collapsible open={isOpen}>
                <CollapsibleText text={argsText} className="mt-2 text-blue-100/80" mono />
              </Collapsible>
            </div>
          );
        })}
      </div>
      {isUser && <Avatar role={role} />}
    </div>
  );
}

function StreamingBubble({ text }) {
  return (
    <div className="flex justify-start gap-2.5">
      <Avatar role="assistant" />
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-purple-500/25 bg-purple-500/6 px-4 py-3 text-slate-100 streaming-pulse">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-purple-300/80">
          <span className="font-medium uppercase tracking-wide">Stark</span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-purple-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
            </span>
            Streaming...
          </span>
        </div>
        {text ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-6">{text}<span className="inline-block h-4 w-0.5 animate-pulse bg-purple-400/70 align-text-bottom" /></div>
        ) : (
          <div className="flex items-center gap-1.5 py-1 text-sm text-slate-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400/60" style={{ animationDelay: '0ms' }} />
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400/60" style={{ animationDelay: '300ms' }} />
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400/60" style={{ animationDelay: '600ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-slate-800" />
      <span className="text-[10px] text-slate-500">{label}</span>
      <div className="h-px flex-1 bg-slate-800" />
    </div>
  );
}

function StatPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700/60 bg-slate-800/40 px-2.5 py-0.5 text-[11px] text-slate-300 tabular-nums">
      {children}
    </span>
  );
}

export default function MessageView({ sessionData, filter, onRefresh, wsConnected, wsReconnecting, streamingText, isStreaming, displayOptions, onDisplayOptionsChange }) {
  useTicker(30_000);
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
  }, [stickToBottom, messageCount, eventCount, streamingText, isStreaming]);

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
      {/* Header */}
      <div className="shrink-0 border-b border-slate-800/60 px-3 py-2">
        {/* Row 1: session label + live + refresh */}
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 truncate text-sm font-medium text-slate-200" title={sessionData.session.name}>
            {sessionData.session.label || sessionData.session.sessionId.slice(0, 8)}
          </h2>
          <span className="hidden text-[11px] text-slate-500 sm:inline">{fmtNum(filteredMessages.length)} msgs</span>

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
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-slate-400 opacity-50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-slate-500" />
              </span>
            </span>
          )}

          {sessionData.parseErrors?.length ? (
            <span className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
              {sessionData.parseErrors.length} err
            </span>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onDisplayOptionsChange?.({ ...displayOptions, showThinking: !displayOptions?.showThinking })}
              className={`rounded-full px-2 py-0.5 text-[10px] transition duration-100 sm:text-[11px] sm:px-2.5 ${
                displayOptions?.showThinking
                  ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              💭
            </button>
            <button
              type="button"
              onClick={() => onDisplayOptionsChange?.({ ...displayOptions, showToolUse: !displayOptions?.showToolUse })}
              className={`rounded-full px-2 py-0.5 text-[10px] transition duration-100 sm:text-[11px] sm:px-2.5 ${
                displayOptions?.showToolUse
                  ? 'bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              🔧
            </button>
            <a
              href={`/api/sessions/${sessionData.session?.name}/export?showThinking=${displayOptions?.showThinking ?? false}&showToolUse=${displayOptions?.showToolUse ?? true}`}
              download
              className="hidden rounded-full px-2.5 py-0.5 text-[11px] text-slate-500 transition duration-100 hover:text-slate-300 hover:bg-slate-800/60 sm:inline-block"
              title="Export as Markdown"
            >
              ↓ Export
            </a>
          </div>
        </div>

        {/* Row 2: stat pills — hidden on very small screens, scrollable on medium */}
        <div className="mt-1 hidden flex-wrap items-center gap-1.5 sm:flex">
          {sessionData.summary?.duration && (
            <StatPill>{sessionData.summary.duration}</StatPill>
          )}
          {sessionData.summary?.totalTokens > 0 && (
            <StatPill>{fmtNum(sessionData.summary.totalTokens)} tok</StatPill>
          )}
          {sessionData.summary?.totalCost > 0 && (
            <StatPill>{fmtCost(sessionData.summary.totalCost)}</StatPill>
          )}
          {sessionData.summary?.models?.length > 0 && (
            <StatPill><span className="truncate max-w-[180px]">{sessionData.summary.models.join(', ')}</span></StatPill>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="no-scrollbar min-h-0 flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="space-y-4 px-3 py-3 sm:px-4">
          {filteredMessages.length ? (
            filteredMessages.map((message, index) => {
              const msgTime = new Date(message.timestamp).getTime();
              const eventsBefore = events.filter((e) => {
                const eTime = new Date(e.timestamp).getTime();
                const prevTime = index > 0 ? new Date(filteredMessages[index - 1].timestamp).getTime() : 0;
                return eTime > prevTime && eTime <= msgTime;
              });

              return (
                <div key={`${message.id || message.timestamp || 'msg'}-${index}`}>
                  {eventsBefore.map((evt, ei) => (
                    <SystemEventDivider key={`evt-${index}-${ei}`} event={evt} />
                  ))}
                  <div className="animate-fade-in-up" style={{ animationDelay: `${Math.min(index, 15) * 30}ms` }}>
                    <MessageBubble
                      message={message}
                      isLastMessage={!isStreaming && index === filteredMessages.length - 1}
                      displayOptions={displayOptions}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-slate-500">No messages</div>
          )}
          {isStreaming && <StreamingBubble text={streamingText} />}
        </div>
      </div>

      {showFloating && (
        <div className="absolute bottom-3 right-3 flex gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-xl border border-blue-500/35 bg-blue-600/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur transition duration-100 hover:bg-blue-500"
            >
              &#8635; Refetch
            </button>
          )}
          <button
            type="button"
            onClick={jumpToBottom}
            className="rounded-xl border border-slate-600 bg-slate-800/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur transition duration-100 hover:bg-slate-700"
          >
            &#8595; Bottom
          </button>
        </div>
      )}
    </div>
  );
}
