import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Security headers applied via middleware
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.clerk.accounts.dev',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
  // Strict mode for development
  reactStrictMode: true,
};

export default nextConfig;
