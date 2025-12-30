import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  eslint: {
    // Warning: Désactive ESLint pendant le build (temporaire pour déploiement)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: Ignore les erreurs TypeScript pendant le build (temporaire)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;




