function SkeletonLine({ className = '' }) {
  return (
    <div className={`animate-shimmer rounded-md ${className}`} />
  );
}

function MessageSkeleton({ align = 'start' }) {
  const isEnd = align === 'end';
  return (
    <div className={`flex ${isEnd ? 'justify-end' : 'justify-start'}`}>
      <div className="w-2/3 space-y-2 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <SkeletonLine className="h-3 w-12 rounded-full" />
          <SkeletonLine className="h-3 w-20 rounded-full" />
        </div>
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-3 w-4/5" />
        {!isEnd && <SkeletonLine className="h-3 w-3/5" />}
      </div>
    </div>
  );
}

export default function Skeleton() {
  return (
    <div className="space-y-3 px-1 py-1 sm:px-2">
      <div className="flex items-center gap-2">
        <SkeletonLine className="h-6 w-32 rounded-lg" />
        <SkeletonLine className="h-4 w-20 rounded-full" />
      </div>
      <div className="space-y-3 pt-1">
        <MessageSkeleton align="end" />
        <MessageSkeleton align="start" />
        <MessageSkeleton align="end" />
        <MessageSkeleton align="start" />
        <MessageSkeleton align="start" />
      </div>
    </div>
  );
}
