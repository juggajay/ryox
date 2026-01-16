import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for Capacitor builds
  output: process.env.BUILD_TARGET === 'capacitor' ? 'export' : undefined,

  // Fix Turbopack workspace root detection
  turbopack: {
    root: __dirname,
  },

  // Required for static export with images
  images: {
    unoptimized: process.env.BUILD_TARGET === 'capacitor',
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ryoxcarpentry.wordifysites.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },

  // Trailing slashes help with static file serving in Capacitor
  trailingSlash: process.env.BUILD_TARGET === 'capacitor',
};

export default nextConfig;
