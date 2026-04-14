type SkeletonProps = {
  className?: string;
};

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={'animate-pulse rounded-lg ' + className}
      style={{ background: '#1E293B' }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border p-4" style={{ background: '#111827', borderColor: '#1E293B' }}>
      <Skeleton className="mb-2 h-3 w-16" />
      <Skeleton className="mb-1 h-6 w-24" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ background: '#111827', borderColor: '#1E293B' }}>
      <div className="px-4 py-3" style={{ background: '#0F1629', borderBottom: '1px solid #1E293B' }}>
        <Skeleton className="h-3 w-full max-w-[300px]" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid #1E293B11' }}>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
          <Skeleton className="mb-4 h-4 w-48" />
          <Skeleton className="h-[220px] w-full" />
        </div>
        <div className="rounded-xl border p-5" style={{ background: '#111827', borderColor: '#1E293B' }}>
          <Skeleton className="mb-4 h-4 w-48" />
          <Skeleton className="h-[220px] w-full" />
        </div>
      </div>
    </div>
  );
}
