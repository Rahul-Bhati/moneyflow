import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Mobile is a separate Expo project with its own tsconfig and its own
    // typecheck step in CI. Don't drag it through the web lint pass.
    "mobile/**",
  ]),
  {
    // Hydration gates (`useEffect(() => setMounted(true), [])`) are a
    // deliberate pattern documented in CLAUDE.md rule #4 — server (UTC) and
    // the user's phone can disagree on "today". This rule flags every one
    // of them; downgrade to a warning so it surfaces in editor noise but
    // doesn't block CI.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
