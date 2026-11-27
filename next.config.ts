import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Demo host URLs keep trailing slash (/slug/) for proxy paths
  skipTrailingSlashRedirect: true,
  // Не тащить тяжёлые Node-пакеты в webpack-граф / traces
  serverExternalPackages: ["playwright", "playwright-core", "nodemailer", "socks"],
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
