#!/usr/bin/env bash
# Corre EN EL VPS como root. Lo invoca GitHub Actions con
#   sudo -n /usr/local/sbin/pharmaweigh-deploy
# después de haber subido la imagen y sincronizado docker-compose.yml + deploy/.
#
# La copia que se EJECUTA vive en /usr/local/sbin (fuera del árbol que el usuario
# `deploy` puede escribir). Si este archivo cambia en el repo hay que reinstalarlo
# desde una máquina con llave root:  bash deploy/instalar_wrapper.sh
#
# Por qué no hay `docker compose build` aquí: el VPS tiene ~1 GiB de RAM libre y
# el swap medio lleno. Un `next build` local lo tumba. La imagen se construye en
# el runner de Actions y llega como tar.gz.
set -euo pipefail

DEST=/opt/pharmaweigh
IMAGEN="$DEST/imagen/pharmaweigh.tar.gz"
COMPOSE=(docker compose -f "$DEST/docker-compose.yml" --env-file "$DEST/.env" -p pharmaweigh)

echo "==> Verificando que el wrapper esté al día"
YO=$(sha256sum "${BASH_SOURCE[0]}" | cut -d' ' -f1)
REPO=$(sha256sum "$DEST/deploy/deploy_remoto.sh" | cut -d' ' -f1)
if [ "$YO" != "$REPO" ]; then
  echo "ERROR: deploy/deploy_remoto.sh cambió en el repo; reinstala el wrapper con acceso root:"
  echo "       bash deploy/instalar_wrapper.sh"
  exit 1
fi

echo "==> Dueño y permisos"
find "$DEST" -path "$DEST/.env" -prune -o -print0 | xargs -0 chown deploy:pharmaweigh
find "$DEST" -type d -print0 | xargs -0 chmod 2775
chown root:root "$DEST/.env"; chmod 600 "$DEST/.env"

set -a; . "$DEST/.env"; set +a
PUERTO="${APP_PORT:-3062}"

if [ ! -f "$IMAGEN" ]; then
  echo "ERROR: no encuentro $IMAGEN. ¿El workflow subió la imagen?"
  exit 1
fi

echo "==> Cargando imagen ($(du -h "$IMAGEN" | cut -f1))"
gunzip -c "$IMAGEN" | docker load

echo "==> Base de datos arriba"
"${COMPOSE[@]}" up -d db
LISTA=no
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T db pg_isready -U pharma -d pharmaweigh >/dev/null 2>&1; then
    LISTA=si; break
  fi
  sleep 2
done
if [ "$LISTA" != "si" ]; then
  echo "ERROR: Postgres no respondió en 60 s"; "${COMPOSE[@]}" logs --tail=60 db; exit 1
fi

echo "==> Migraciones (si fallan, el contenedor viejo sigue vivo y sirviendo)"
"${COMPOSE[@]}" run --rm --no-deps app node scripts/migrar.mjs

echo "==> Levantando app"
"${COMPOSE[@]}" up -d app

echo "==> Health check local"
COD=""
for _ in $(seq 1 30); do
  COD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PUERTO}/api/salud" || true)
  [ "$COD" = "200" ] && break
  sleep 2
done
if [ "$COD" != "200" ]; then
  echo "ERROR: /api/salud devolvió ${COD:-nada}"; "${COMPOSE[@]}" logs --tail=60 app; exit 1
fi
echo "    http $COD"

# El disco del VPS anda al 92 %: cada deploy deja una imagen huérfana de ~300 MB.
echo "==> Limpieza de imágenes viejas y del tar"
docker image prune -f >/dev/null || true
rm -f "$IMAGEN"

echo "==> Deploy OK: $(date '+%F %T')"
df -h / | tail -1
free -h | head -2
