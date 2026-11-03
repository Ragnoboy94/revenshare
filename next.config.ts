import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Demo host serves /slug/ → public/demos/slug/index.html; don't strip slash before rewrite
  skipTrailingSlashRedirect: true,
  // Dev через tuna / ngrok: иначе /_next и HMR с чужого Origin тормозят или рвутся
  allowedDevOrigins: [
    "*.ru.tuna.am",
    "*.tuna.am",
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
