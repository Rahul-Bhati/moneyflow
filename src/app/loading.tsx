/**
 * Streaming skeleton for the dashboard.
 *
 * Every page here is `force-dynamic`, so without a loading boundary the user
 * stares at a blank tab while Clerk auth + the Supabase query run. This file
 * makes Next stream the shell immediately and swap in the real page when the
 * data lands. Pure server markup — no client JS in the skeleton.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md animate-pulse flex-col px-4 pt-3 md:max-w-5xl md:px-8 lg:max-w-6xl">
      {/* header strip */}
      <div className="flex items-center justify-between py-3.5">
        <div className="space-y-2">
          <div className="h-5 w-28 rounded-md bg-surface-2" />
          <div className="h-3 w-20 rounded-md bg-surface-2" />
        </div>
        <div className="flex gap-2">
          <div className="size-9 rounded-full bg-surface-2" />
          <div className="size-9 rounded-full bg-surface-2" />
          <div className="size-8 rounded-full bg-surface-2" />
        </div>
      </div>

      {/* period filter */}
      <div className="mb-4 h-11 rounded-2xl bg-surface-2" />

      {/* summary cards + chart */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="h-28 rounded-3xl bg-surface-2" />
          <div className="h-28 rounded-3xl bg-surface-2" />
        </div>
        <div className="h-60 rounded-3xl bg-surface-2" />
        <div className="hidden space-y-3 lg:block">
          <div className="h-16 rounded-2xl bg-surface-2" />
          <div className="h-16 rounded-2xl bg-surface-2" />
          <div className="h-16 rounded-2xl bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
