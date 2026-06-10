import { useColorScheme } from "react-native";

/**
 * Port of the design tokens defined in `src/app/globals.css` for the web app.
 * We mirror them rather than share so the two apps can drift independently if
 * we ever need to (e.g. iOS-only adjustments) — but keep them in lockstep by
 * default so the brand feels identical.
 *
 * Use via the `useTheme()` hook: every component pulls a `t` object whose
 * properties switch automatically when the user toggles between light and
 * dark mode.
 */

export interface Theme {
  bg: string;
  bgGlow: string;
  surface: string;
  surface2: string;
  ink: string;
  inkSoft: string;
  muted: string;
  border: string;
  borderStrong: string;
  income: string;
  incomeSoft: string;
  expense: string;
  expenseSoft: string;
  accent: string;
  accentInk: string;
  ring: string;
  radiusXl: number;
  radius2xl: number;
  radiusLg: number;
  font: { display: string; mono: string };
}

const LIGHT: Theme = {
  bg: "#f3f0e9",
  bgGlow: "rgba(251, 248, 240, 1)",
  surface: "#ffffff",
  surface2: "#faf8f3",
  ink: "#1a1714",
  inkSoft: "#4a443c",
  muted: "#948d80",
  border: "rgba(26, 23, 20, 0.08)",
  borderStrong: "rgba(26, 23, 20, 0.14)",
  income: "#16895c",
  incomeSoft: "rgba(22, 137, 92, 0.1)",
  expense: "#d6543a",
  expenseSoft: "rgba(214, 84, 58, 0.1)",
  accent: "#1a1714",
  accentInk: "#faf8f3",
  ring: "rgba(26, 23, 20, 0.16)",
  radiusXl: 24,
  radius2xl: 32,
  radiusLg: 16,
  font: {
    display: "System",
    mono: "Menlo",
  },
};

const DARK: Theme = {
  bg: "#100f0c",
  bgGlow: "rgba(30, 27, 22, 1)",
  surface: "#1a1815",
  surface2: "#211e1a",
  ink: "#f1ede4",
  inkSoft: "#c9c3b6",
  muted: "#8c857a",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)",
  income: "#3ddc97",
  incomeSoft: "rgba(61, 220, 151, 0.12)",
  expense: "#ff8a6b",
  expenseSoft: "rgba(255, 138, 107, 0.13)",
  accent: "#f1ede4",
  accentInk: "#16140f",
  ring: "rgba(255, 255, 255, 0.22)",
  radiusXl: 24,
  radius2xl: 32,
  radiusLg: 16,
  font: {
    display: "System",
    mono: "Menlo",
  },
};

export function useTheme(): { t: Theme; scheme: "light" | "dark" } {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { t: scheme === "dark" ? DARK : LIGHT, scheme };
}
