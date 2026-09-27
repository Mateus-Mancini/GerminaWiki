import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export to out/ for Firebase Hosting: no Next.js server exists in production,
  // so server-only features (SSR per request, Server Actions, proxy, rewrites, ISR) are unavailable.
  output: "export",
  // Default image optimization needs a server; serve images as-is.
  images: { unoptimized: true },
};

export default nextConfig;
