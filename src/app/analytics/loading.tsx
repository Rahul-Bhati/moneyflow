/** Streaming skeleton for /analytics — see src/app/loading.tsx for rationale. */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md animate-pulse flex-col px-4 pt-3 md:max-w-5xl md:px-8 lg:max-w-6xl">
      <div className="flex items-center justify-between py-3.5">
        <div className="h-5 w-28 rounded-md bg-surface-2" />
        <div className="size-9 rounded-full bg-surface-2" />
      </div>

      {/* period filter */}
      <div className="mb-4 h-11 rounded-2xl bg-surface-2" />

      {/* chart panels — mirror the real grid so the swap doesn't jump */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-64 rounded-3xl bg-surface-2" />
        <div className="h-64 rounded-3xl bg-surface-2" />
        <div className="h-48 rounded-3xl bg-surface-2" />
        <div className="h-48 rounded-3xl bg-surface-2" />
      </div>
    </div>
  );
}
