import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

// Next only reads `.env*` under `apps/web` unless we pull from the repo root.
// Shared secrets often live only in `/Robin.dev/.env.local`.
loadEnvConfig(path.resolve(__dirname, "../.."));
loadEnvConfig(path.resolve(__dirname));

const nextConfig: NextConfig = {
  transpilePackages: ["@robin/shared-types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "**.myanimelist.net" },
    ],
  },
  eslint: {
    // Lint runs in CI (github-actions); skip it during `next build` to avoid
    // devDependency availability issues in production build environments.
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/sprints/:id",
        destination: "/sprints",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
