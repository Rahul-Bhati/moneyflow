"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart } from "recharts";

export interface SparklineProps {
  values: number[];
  tone: "income" | "expense" | "ink";
  height?: number;
}

const VAR = {
  income: "var(--income)",
  expense: "var(--expense)",
  ink: "var(--ink-soft)",
} as const;

export default function Sparkline({ values, tone, height = 32 }: SparklineProps) {
  // We measure our own width and render a fixed-size <AreaChart> only once the
  // box is real. Recharts' <ResponsiveContainer> renders once at -1×-1 before
  // its ResizeObserver fires, which floods the console with a width/height
  // warning on every dashboard paint. Measuring ourselves skips that.
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recharts' `data` prop participates in its diff — a fresh array every
  // render makes it re-render the SVG even when `values` didn't change.
  const data = useMemo(() => values.map((v, i) => ({ i, v })), [values]);
  const stroke = VAR[tone];
  const gradientId = `sparkline-${tone}`;

  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {width > 0 && (
        <AreaChart
          width={width}
          height={height}
          data={data}
          margin={{ top: 2, bottom: 0, left: 0, right: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.6}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      )}
    </div>
  );
}
