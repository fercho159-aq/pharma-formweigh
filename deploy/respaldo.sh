#!/usr/bin/env bash
# Se instala en /usr/local/sbin/pharmaweigh-respaldo (root) y lo dispara
# /etc/cron.d/pharmaweigh. pg_dump del contenedor `db` comprimido, retención 14 días.
#
# Restaurar (ver docs/OPERACION.md):
#   zcat /opt/backups/pharmaweigh/pharmaweigh_2026-09-18_0330.sql.gz \
#     | docker compose -f /opt/pharmaweigh/docker-compose.yml --env-file /opt/pharmaweigh/.env \
#       -p pharmaweigh exec -T db psql -U pharma pharmaweigh
set -euo pipefail

DEST=/opt/pharmaweigh
DESTINO=/opt/backups/pharmaweigh
RETENCION_DIAS=14
COMPOSE=(docker compose -f "$DEST/docker-compose.yml" --env-file "$DEST/.env" -p pharmaweigh)

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"

ARCHIVO="$DESTINO/pharmaweigh_$(date +%F_%H%M).sql.gz"
PARCIAL="$ARCHIVO.parcial"

# Se escribe a .parcial y se renombra al final: así un dump interrumpido nunca
# queda en el directorio pareciendo un respaldo bueno.
if "${COMPOSE[@]}" exec -T db pg_dump -U pharma --clean --if-exists pharmaweigh | gzip -9 > "$PARCIAL"; then
  mv "$PARCIAL" "$ARCHIVO"
  chmod 600 "$ARCHIVO"
  logger -t pharmaweigh-respaldo "respaldo ok $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"
else
  rm -f "$PARCIAL"
  logger -t pharmaweigh-respaldo "ERROR: pg_dump falló"
  exit 1
fi

# Retención. El disco del VPS anda al 92 %, esto no es opcional.
find "$DESTINO" -name 'pharmaweigh_*.sql.gz' -mtime +"$RETENCION_DIAS" -delete
find "$DESTINO" -name '*.parcial' -mtime +1 -delete
