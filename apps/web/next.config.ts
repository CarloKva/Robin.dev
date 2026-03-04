import type { NextConfig } from "next";

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
