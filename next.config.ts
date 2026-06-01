import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (restaurant/review photos)
      { protocol: 'https', hostname: '*.supabase.co' },
      // Google Places photo CDN
      { protocol: 'https', hostname: 'places.googleapis.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: '*.ggpht.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: 'maps.gstatic.com' },
      { protocol: 'https', hostname: 'streetviewpixels-pa.googleapis.com' },
      // Stock/fallback imagery (cuisine + city photos)
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Yelp business photos
      { protocol: 'https', hostname: 's3-media0.fl.yelpcdn.com' },
      { protocol: 'https', hostname: 's3-media1.fl.yelpcdn.com' },
      { protocol: 'https', hostname: 's3-media2.fl.yelpcdn.com' },
      { protocol: 'https', hostname: 's3-media3.fl.yelpcdn.com' },
      // Social video thumbnails
      { protocol: 'https', hostname: '*.cdninstagram.com' },
      { protocol: 'https', hostname: '*.tiktokcdn.com' },
      { protocol: 'https', hostname: '*.tiktokcdn-us.com' },
    ],
  },
  async redirects() {
    return [
      // Old leaderboard routes now live on /explore (hub) and /recent (feed).
      // The nav, footer, and inline links were all updated, but we keep
      // these so external links and bookmarks don't 404.
      { source: '/restaurants', destination: '/explore', permanent: true },
      { source: '/cities', destination: '/explore', permanent: true },
      { source: '/cities/:slug', destination: '/explore', permanent: true },
      { source: '/feed', destination: '/recent', permanent: true },
      { source: '/top-rated', destination: '/explore', permanent: true },
      { source: '/discover', destination: '/explore', permanent: true },
      { source: '/profile/edit', destination: '/profile', permanent: true },
    ]
  },
};

export default nextConfig;
