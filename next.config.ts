import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Fix Yjs multiple imports issue for webpack
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: "yjs",
    };

    return config;
  },
  turbopack: {
    resolveAlias: {
      // Fix Yjs multiple imports issue for turbopack
      yjs: "yjs",
    },
  },
};

export default nextConfig;
