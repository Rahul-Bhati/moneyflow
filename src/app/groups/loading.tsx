/** Streaming skeleton for /groups. */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md animate-pulse flex-col px-4 pt-3 md:max-w-3xl md:px-8">
      <div className="flex items-center justify-between py-3.5">
        <div className="h-5 w-24 rounded-md bg-surface-2" />
        <div className="size-9 rounded-full bg-surface-2" />
      </div>
      <div className="space-y-3 pt-2">
        <div className="h-20 rounded-3xl bg-surface-2" />
        <div className="h-20 rounded-3xl bg-surface-2" />
        <div className="h-20 rounded-3xl bg-surface-2" />
      </div>
    </div>
  );
}
