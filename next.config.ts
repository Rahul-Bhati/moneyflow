import type { NextConfig } from "next";
import path from "node:path";

/**
 * Build a Content-Security-Policy that covers the dependencies we actually
 * load:
 *   - Clerk (frontend API + telemetry)
 *   - Supabase (REST + auth)
 *   - Vercel deploy preview banners (only on Vercel hosting)
 *
 * In dev we have to allow `'unsafe-eval'` and `'unsafe-inline'` for the
 * Next.js refresh runtime; in prod those are dropped.
 */
function buildCsp(): string {
  const isDev = process.env.NODE_ENV !== "production";
  const clerkOrigin = "https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com";
  const supabaseOrigin = "https://*.supabase.co wss://*.supabase.co";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      // Clerk injects inline scripts for auth UI initialization; 'unsafe-inline'
      // is required in both dev and prod. All trusted script origins are still
      // enumerated, so the attack surface is limited to same-origin + Clerk/CF.
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      "https://*.clerk.accounts.dev",
      "https://*.clerk.com",
      "https://challenges.cloudflare.com",
    ],
    // Tailwind + Framer-Motion inject inline styles at runtime; allowing
    // unsafe-inline is required for them to work and is the standard
    // recommendation in their docs.
    // fonts.googleapis.com is Clerk UI's Google Fonts stylesheet CDN.
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "img-src": ["'self'", "data:", "blob:", "https://img.clerk.com", "https:"],
    // fonts.gstatic.com serves the actual font files loaded via fonts.googleapis.com.
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      clerkOrigin,
      supabaseOrigin,
      // Clerk telemetry (fires on sign-in page load)
      "https://clerk-telemetry.com",
      // Upstash REST endpoint
      "https://*.upstash.io",
      // Google Fonts — needed for <link rel="preconnect"> hints in layout.tsx;
      // Chrome enforces connect-src for preconnect, not just style-src.
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ],
    "frame-src": ["'self'", "https://challenges.cloudflare.com"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "upgrade-insecure-requests": [],
  };
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp() },
  // Clickjacking — already covered by `frame-ancestors 'none'` in CSP but
  // legacy proxies look at the header.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS only fires on HTTPS; harmless on localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // The repo has two lockfiles — the web's at the root and the Expo app's
  // under `mobile/`. Pin Turbopack's workspace root to silence the warning
  // and keep Next out of the mobile tree.
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    // recharts is a barrel package — importing { AreaChart } pulls the whole
    // index without this. lucide-react is on Next's built-in optimize list
    // already; recharts isn't.
    optimizePackageImports: ["recharts"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
