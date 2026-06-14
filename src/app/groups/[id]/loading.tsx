/** Streaming skeleton for a space detail page. */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md animate-pulse flex-col px-4 pt-3 md:max-w-3xl md:px-8">
      <div className="flex items-center justify-between py-3.5">
        <div className="h-5 w-32 rounded-md bg-surface-2" />
        <div className="size-9 rounded-full bg-surface-2" />
      </div>
      <div className="h-24 rounded-3xl bg-surface-2" />
      <div className="mt-4 h-4 w-20 rounded bg-surface-2" />
      <div className="mt-3 space-y-3">
        <div className="h-16 rounded-2xl bg-surface-2" />
        <div className="h-16 rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}
