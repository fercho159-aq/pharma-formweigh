# PharmaWeigh — imagen de producción (Next 16 standalone). Nginx del host termina TLS.
#
# IMPORTANTE: esta imagen NO se construye en el VPS (solo ~1 GiB de RAM libre).
# Se construye en el runner de GitHub Actions y viaja como tar.gz. Ver .github/workflows/deploy.yml
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Variable pública: se hornea en el bundle durante el build, no en runtime.
ARG NEXT_PUBLIC_SITE_URL=https://pharmaweigh.appsoluciones.duckdns.org
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# Solo para que `next build` recolecte las rutas: importar el cliente de Drizzle
# construye el pool. postgres-js no abre conexión hasta la primera consulta, así que
# este valor nunca se usa en runtime (el real lo inyecta el compose).
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=America/Mexico_City
RUN apk add --no-cache tzdata wget && addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# Migraciones: el wrapper corre `node scripts/migrar.mjs` dentro de esta misma imagen.
COPY --from=builder --chown=app:app /app/drizzle ./drizzle
COPY --from=builder --chown=app:app /app/scripts/migrar.mjs ./scripts/migrar.mjs
# Operación desde consola (docs/OPERACION.md): alta de usuarios y datos de demostración.
COPY --from=builder --chown=app:app /app/scripts/crear-usuario.mjs ./scripts/crear-usuario.mjs
COPY --from=builder --chown=app:app /app/scripts/seed.mjs ./scripts/seed.mjs
COPY --from=builder --chown=app:app /app/scripts/usuario.mjs ./scripts/usuario.mjs
# El standalone trae solo lo que Next trazó; el migrador necesita los paquetes completos.
COPY --from=builder --chown=app:app /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=app:app /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder --chown=app:app /app/node_modules/bcryptjs ./node_modules/bcryptjs
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/salud || exit 1
CMD ["node", "server.js"]
