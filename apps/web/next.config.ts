import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@robin/shared-types"],
  eslint: {
    // Lint runs in CI (github-actions); skip it during `next build` to avoid
    // devDependency availability issues in production build environments.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
