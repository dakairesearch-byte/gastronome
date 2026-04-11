import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['apify-client'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
