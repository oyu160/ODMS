import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Хөтчийн аюулгүй байдлын толгой (HTTPS-ийг Caddyfile-д HSTS-ээр албадна)
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
    authInterrupts: true, // forbidden() → HTTP 403 (ФБШ-02)
    serverActions: { bodySizeLimit: "20mb" }, // ФБШ-07: файлын дээд хэмжээ 20 MB
  },
};

export default nextConfig;
