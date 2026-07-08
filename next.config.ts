import type { NextConfig } from 'next';
import { withReticle } from '@reticlehq/core/next';

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
  // Silence Turbopack webpack config presence error by supplying empty config per Next.js 16 instructions
  turbopack: {},
};

// Satisfy Next.js type-checker due to minor typing discrepancies between Reticle and Next.js 16's NextConfig type
export default withReticle(nextConfig as any) as any;
