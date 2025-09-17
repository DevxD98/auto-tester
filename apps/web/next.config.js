import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Load env from monorepo root .env so users don't need apps/web/.env.local
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) { /* ignore */ }

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent Next from trying to bundle playwright internals; keep them as runtime deps only.
      config.externals = config.externals || [];
      config.externals.push({
        playwright: 'commonjs playwright',
        'playwright-core': 'commonjs playwright-core',
        'chromium-bidi/lib/cjs/bidiMapper/BidiMapper': 'commonjs chromium-bidi/lib/cjs/bidiMapper/BidiMapper'
      });
    }
    return config;
  }
};
export default nextConfig;
