"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { money } from "@/lib/format";

export default function AnimatedNumber({
  value,
  precise = false,
  className,
}: {
  value: number;
  precise?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1], // expo-out, very "iOS"
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <span className={className} suppressHydrationWarning>
      {money(display, precise)}
    </span>
  );
}
