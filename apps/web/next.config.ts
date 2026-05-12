import type { NextConfig } from 'next';

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(isStaticExport ? {
    output: 'export' as const,
    trailingSlash: true,
    ...(basePath ? { basePath } : {}),
  } : {}),
  images: {
    ...(isStaticExport ? { unoptimized: true } : {}),
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.gatcg.com',
      },
      {
        protocol: 'https',
        hostname: 'api.gatcg.com',
      },
      {
        protocol: 'https',
        hostname: '**.gatcg.com',
      },
    ],
  },
  // Keep the Bun SQLite binding external to the Next server bundle.
  ...(isStaticExport ? {} : { serverExternalPackages: ['drizzle-orm', 'bun:sqlite'] }),
};

export default nextConfig;
