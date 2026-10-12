import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  transpilePackages: ["@prospex/types"],
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  allowedDevOrigins: ['app.alatpintar.id']
};

export default nextConfig;
