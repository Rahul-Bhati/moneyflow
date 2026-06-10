"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

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
  // Recharts' `data` prop participates in its diff — a fresh array every
  // render makes it re-render the SVG even when `values` didn't change.
  const data = useMemo(() => values.map((v, i) => ({ i, v })), [values]);
  const stroke = VAR[tone];
  const gradientId = `sparkline-${tone}`;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
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
      </ResponsiveContainer>
    </div>
  );
}
