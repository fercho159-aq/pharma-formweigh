#!/usr/bin/env bash
# Instala/actualiza los scripts root del VPS (wrapper de deploy, respaldo, cron y sudoers).
# Correr desde la máquina local CON ACCESO ROOT (llave de admin, no la de Actions).
#   bash deploy/instalar_wrapper.sh [host_ssh]   (default: maw-vps)
#
# Es idempotente: se puede repetir tantas veces como haga falta. Hay que repetirlo
# cada vez que cambie deploy/deploy_remoto.sh, deploy/respaldo.sh, deploy/cron/pharmaweigh
# o deploy/sudoers, porque el deploy automático NO puede tocar /usr/local/sbin.
set -euo pipefail
HOST="${1:-maw-vps}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

scp -q "${RAIZ}/deploy/deploy_remoto.sh"   "${HOST}:/tmp/pw-deploy.nuevo"
scp -q "${RAIZ}/deploy/respaldo.sh"        "${HOST}:/tmp/pw-respaldo.nuevo"
scp -q "${RAIZ}/deploy/cron/pharmaweigh"   "${HOST}:/tmp/pw-crontab.nuevo"
scp -q "${RAIZ}/deploy/sudoers"            "${HOST}:/tmp/pw-sudoers.nuevo"
ssh "$HOST" '
  set -euo pipefail
  install -o root -g root -m 0755 /tmp/pw-deploy.nuevo   /usr/local/sbin/pharmaweigh-deploy
  install -o root -g root -m 0755 /tmp/pw-respaldo.nuevo /usr/local/sbin/pharmaweigh-respaldo
  install -o root -g root -m 0644 /tmp/pw-crontab.nuevo  /etc/cron.d/pharmaweigh
  # visudo -c antes de instalar: un sudoers inválido deja el VPS sin sudo.
  visudo -cf /tmp/pw-sudoers.nuevo >/dev/null
  install -o root -g root -m 0440 /tmp/pw-sudoers.nuevo  /etc/sudoers.d/pharmaweigh-deploy
  rm -f /tmp/pw-*.nuevo
  ls -l /usr/local/sbin/pharmaweigh-deploy /usr/local/sbin/pharmaweigh-respaldo \
        /etc/cron.d/pharmaweigh /etc/sudoers.d/pharmaweigh-deploy'
echo "==> Listo"
