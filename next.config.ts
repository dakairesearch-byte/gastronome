import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      // Old leaderboard routes now live on /explore (hub) and /recent (feed).
      // The nav, footer, and inline links were all updated, but we keep
      // these so external links and bookmarks don't 404.
      { source: '/restaurants', destination: '/explore', permanent: true },
      { source: '/feed', destination: '/recent', permanent: true },
      { source: '/top-rated', destination: '/explore', permanent: true },
      { source: '/discover', destination: '/explore', permanent: true },
      { source: '/profile/edit', destination: '/profile', permanent: true },
    ]
  },
};

export default nextConfig;
