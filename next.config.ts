import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad. HSTS va aquí (solo en producción) porque certbot reescribe el vhost
 * de nginx; sin includeSubDomains: el dominio padre duckdns es compartido con otros sitios.
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
  // Sin insignia de desarrollo: tapa el avatar del usuario en las capturas de los manuales.
  devIndicators: false,
  serverExternalPackages: ["postgres"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
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
