import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@robin/shared-types"],
};

export default nextConfig;
