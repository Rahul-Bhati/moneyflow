import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The repo has two lockfiles — the web's at the root and the Expo app's
  // under `mobile/`. Pin Turbopack's workspace root to silence the warning
  // and keep Next out of the mobile tree.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
