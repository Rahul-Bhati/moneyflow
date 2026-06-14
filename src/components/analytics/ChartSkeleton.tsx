export default function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      aria-hidden
      className="animate-pulse rounded-[var(--radius-2xl)] border border-border bg-surface"
      style={{ height }}
    />
  );
}
