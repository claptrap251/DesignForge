import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "jsdom", "mermaid"],
  output: "standalone",
};

export default nextConfig;
