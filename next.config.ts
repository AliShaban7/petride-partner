import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is deliberately OFF: every dashboard route is behind a session cookie and
  // reads per-partner data, so nothing benefits from a prerendered static shell, and keeping the
  // classic dynamic model lets page builders read `cookies()` / `params` without Suspense rules.
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    // Pin the root to this folder, so Turbopack never resolves files from a parent folder
    // (this app can also live inside a larger repo with its own lockfile).
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
