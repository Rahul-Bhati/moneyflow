/** Streaming skeleton for /bills — see src/app/loading.tsx for rationale. */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md animate-pulse flex-col px-4 pt-3 md:max-w-5xl md:px-8 lg:max-w-6xl">
      <div className="flex items-center justify-between py-3.5">
        <div className="h-5 w-20 rounded-md bg-surface-2" />
        <div className="flex gap-2">
          <div className="size-9 rounded-full bg-surface-2" />
          <div className="size-8 rounded-full bg-surface-2" />
        </div>
      </div>

      {/* kanban columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-24 rounded-md bg-surface-2" />
            <div className="h-24 rounded-2xl bg-surface-2" />
            <div className="h-24 rounded-2xl bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
