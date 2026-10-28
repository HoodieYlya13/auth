import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors. We will handle type checking manually.
    ignoreBuildErrors: true,
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  reactCompiler: true,
  cacheComponents: true,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/en",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nobody may frame these pages: a hidden consent screen under
          // someone's cursor would turn a click into "Allow" (clickjacking).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/.well-known/openid-configuration",
        destination: "/api/oidc/discovery",
      },
      {
        source: "/.well-known/jwks.json",
        destination: "/api/oidc/jwks",
      },
    ];
  },
};

export default nextConfig;
