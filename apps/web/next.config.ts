import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@prospex/types"],
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
