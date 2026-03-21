import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "jsdom", "mermaid"],
  output: "standalone",
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
