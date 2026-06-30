import type { NextConfig } from "next";

// GitHub Pages: NEXT_PUBLIC_BASE_PATH=/MyFit
// Capacitor(모바일): basePath 없음 (file:// 로드)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
