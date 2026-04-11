import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'apify-client',
    'proxy-agent',
    'agent-base',
    'http-proxy-agent',
    'https-proxy-agent',
    'pac-proxy-agent',
    'socks-proxy-agent',
    'proxy-from-env',
    '@apify/consts',
    '@apify/log',
    '@apify/utilities',
    '@crawlee/types',
    'ow',
  ],
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
