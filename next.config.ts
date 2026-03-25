import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "jsdom", "mermaid"],
  output: "standalone",
  ...(process.env.ALLOWED_DEV_ORIGINS
    ? { allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS.split(",") }
    : {}),
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
