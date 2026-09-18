import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad. HSTS lo agrega nginx (TLS termina ahí).
 * La app no carga nada de terceros. `blob:`/`data:` en img: etiquetas de códigos de barras
 * y vista de cámara del lector (html5-qrcode). Cámara permitida solo al propio origen.
 */
const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' solo en desarrollo (React Refresh); en producción no se emite.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["postgres"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
