import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Capacitor 빌드 전용 — 항상 정적 익스포트
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
