# Primera instalación de PharmaWeigh en `maw-vps`

Guía de una sola vez. El runbook completo del día a día está en
[`../docs/OPERACION.md`](../docs/OPERACION.md); aquí solo va el arranque desde cero.

Publicar un servicio nuevo en `maw-vps` **requiere visto bueno de Fernando**
(manual MAW §9), por la RAM. Confirmar antes de correr nada.

## 0. Antes de empezar

| Dato | Valor |
|---|---|
| VPS | `maw-vps` — 31.220.109.7 |
| Carpeta | `/opt/pharmaweigh` |
| Usuario de deploy | `deploy` (uid 1001, ya existe) |
| Grupo | `pharmaweigh` (se crea en el paso 1) |
| Puerto host | **3062** (3060 Club MP, 3061 Treca) |
| Dominio | `pharmaweigh.appsoluciones.duckdns.org` (wildcard DNS ya existe) |
| Respaldos | `/opt/backups/pharmaweigh` |

Revisar margen antes de instalar:

```bash
ssh maw-vps 'uptime; free -h; df -h /'
```

Si la RAM libre + swap disponible no da para ~640 MiB (384 app + 256 db), **parar
y avisar**. No se instala encima de un VPS ahogado.

## 1. Carpetas, grupo y permisos (root en el VPS)

```bash
ssh maw-vps
groupadd -f pharmaweigh
usermod -aG pharmaweigh deploy
mkdir -p /opt/pharmaweigh/imagen /opt/backups/pharmaweigh
chown -R deploy:pharmaweigh /opt/pharmaweigh
chmod 2775 /opt/pharmaweigh /opt/pharmaweigh/imagen
chmod 700 /opt/backups/pharmaweigh
```

## 2. `.env` de producción (root, 600)

```bash
# En el VPS, como root:
openssl rand -base64 32      # -> POSTGRES_PASSWORD, guardar en el gestor de contraseñas
cat > /opt/pharmaweigh/.env <<'EOF'
POSTGRES_PASSWORD=<lo-que-salió-arriba>
DATABASE_URL=postgres://pharma:<misma-contraseña>@db:5432/pharmaweigh
NEXT_PUBLIC_SITE_URL=https://pharmaweigh.appsoluciones.duckdns.org
APP_PORT=3062
TZ=America/Mexico_City
EOF
chown root:root /opt/pharmaweigh/.env
chmod 600 /opt/pharmaweigh/.env
```

## 3. Scripts root (desde la máquina local, con llave de admin)

```bash
cd ~/Developer/pharma-formweigh
bash deploy/instalar_wrapper.sh maw-vps
```

Instala `/usr/local/sbin/pharmaweigh-deploy`, `/usr/local/sbin/pharmaweigh-respaldo`,
`/etc/cron.d/pharmaweigh` y `/etc/sudoers.d/pharmaweigh-deploy`. Es idempotente.

## 4. nginx + TLS (root en el VPS)

El archivo del vhost llega con el primer deploy, pero se puede copiar a mano:

```bash
scp deploy/nginx/pharmaweigh.conf maw-vps:/tmp/
ssh maw-vps
install -m 644 /tmp/pharmaweigh.conf /etc/nginx/sites-available/pharmaweigh
ln -sf /etc/nginx/sites-available/pharmaweigh /etc/nginx/sites-enabled/pharmaweigh
nginx -t && systemctl reload nginx
certbot --nginx -d pharmaweigh.appsoluciones.duckdns.org
nginx -t && systemctl reload nginx
```

`certbot --nginx` reescribe el archivo agregando el `listen 443`, el certificado y
la redirección de 80 a 443. La renovación automática ya está configurada en el VPS
para los demás sitios; verificar con `systemctl list-timers | grep certbot`.

## 5. Secretos de GitHub (repo → Settings → Secrets and variables → Actions)

| Secreto | Contenido |
|---|---|
| `VPS_HOST` | `31.220.109.7` |
| `VPS_SSH_KEY` | llave privada **ed25519 del usuario `deploy`**, completa, con sus líneas `BEGIN`/`END` |
| `VPS_KNOWN_HOSTS` | salida de `ssh-keyscan -H 31.220.109.7` |

La llave de `deploy` ya existe (la usan Club MP y Treca); reutilizarla, no generar una nueva.
Su `authorized_keys` vive en `/home/deploy/.ssh/authorized_keys`.

## 6. Primer deploy

Push a `main`, o desde la pestaña Actions → *Deploy VPS* → *Run workflow*.

El workflow construye la imagen en el runner, la sube como tar.gz y el wrapper la
carga, corre migraciones, levanta y verifica `/api/salud`.

## 7. Datos iniciales (una vez, después del primer deploy)

```bash
ssh maw-vps
cd /opt/pharmaweigh
CO="docker compose -f docker-compose.yml --env-file .env -p pharmaweigh"

# Usuario administrador real (la contraseña se genera y se imprime UNA vez; o pásala con -e PHARMA_PASSWORD=…):
$CO run --rm --no-deps app node scripts/crear-usuario.mjs correo@dominio "Nombre Apellido" ADMIN

# SOLO para la demo comercial: 7 usuarios (uno por rol), materiales, lotes, recetas y órdenes de ejemplo.
# Se niega a correr si ya hay materiales. Imprime las contraseñas aleatorias una sola vez: guárdalas
# en /opt/pharmaweigh/CREDENCIALES_DEMO.txt (root, 600), nunca en el repo.
$CO run --rm --no-deps app node scripts/seed.mjs
```

Ambos scripts viajan dentro de la imagen (ver `Dockerfile`): no hace falta el repo ni `tsx` en el VPS.

## 8. Verificación final

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://pharmaweigh.appsoluciones.duckdns.org/api/salud  # 200
ssh maw-vps 'docker compose -f /opt/pharmaweigh/docker-compose.yml --env-file /opt/pharmaweigh/.env -p pharmaweigh ps'
ssh maw-vps 'free -h; df -h /'
ssh maw-vps '/usr/local/sbin/pharmaweigh-respaldo && ls -lh /opt/backups/pharmaweigh'
```

Registrar el puerto **3062** en el inventario del manual MAW §6.
