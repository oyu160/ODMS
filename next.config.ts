import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Hutchiin ayuulgui baidliin tolgoi (HTTPS-iig Caddyfile-d HSTS-eer albadna)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    authInterrupts: true, // forbidden() → HTTP 403 (FBSh-02)
    serverActions: { bodySizeLimit: "20mb" }, // FBSh-07: failiin deed hemjee 20 MB
  },
};

export default nextConfig;
