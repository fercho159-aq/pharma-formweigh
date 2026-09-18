# Operación — PharmaWeigh

Runbook del servicio en producción. Está escrito para que cualquier persona con
acceso al VPS resuelva sin llamarle a Fernando. Todo en español, comandos listos
para copiar.

**Atajo:** el 90 % de los problemas se contesta con estas tres líneas.

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://pharmaweigh.appsoluciones.duckdns.org/api/salud
ssh maw-vps 'uptime; free -h; df -h /'
ssh maw-vps 'docker compose -f /opt/pharmaweigh/docker-compose.yml --env-file /opt/pharmaweigh/.env -p pharmaweigh ps'
```

Para no repetir el `docker compose ... -f ... --env-file ...` en cada comando,
conviene definir el atajo al entrar al VPS:

```bash
ssh maw-vps
cd /opt/pharmaweigh
CO="docker compose -f /opt/pharmaweigh/docker-compose.yml --env-file /opt/pharmaweigh/.env -p pharmaweigh"
```

En el resto del documento `$CO` significa exactamente eso.

---

## 1. Infraestructura

| Cosa | Dónde |
|---|---|
| VPS | `maw-vps` — 31.220.109.7 (2 vCPU / 8 GB RAM, ~28 sitios en nginx) |
| Carpeta | `/opt/pharmaweigh`, dueño `deploy:pharmaweigh` |
| Secretos | `/opt/pharmaweigh/.env` — root, `chmod 600` |
| Contenedores | `app` (Next 16 standalone, `127.0.0.1:3062`) y `db` (postgres:16-alpine, volumen `pgdata`) |
| Límites de RAM | `app` 384 MiB · `db` 256 MiB (fijados en `docker-compose.yml`) |
| Imagen | `pharmaweigh:latest`, construida en GitHub Actions y cargada con `docker load` |
| nginx | `/etc/nginx/sites-available/pharmaweigh` → `https://pharmaweigh.appsoluciones.duckdns.org` |
| TLS | certbot (`certbot --nginx`), renovación automática del VPS |
| DNS | wildcard `*.appsoluciones.duckdns.org` (cuenta `solucionesmaw@gmail.com`) |
| Cron | `/etc/cron.d/pharmaweigh` → `/usr/local/sbin/pharmaweigh-respaldo` |
| Respaldos | `/opt/backups/pharmaweigh/*.sql.gz`, retención 14 días |

### Registro de puertos en `maw-vps`

| Puerto | Proyecto |
|---|---|
| 3000–3050 | ocupados de antes |
| 3060 | Club Mini Precios |
| 3061 | Treca |
| **3062** | **PharmaWeigh** |

Cualquier servicio nuevo toma 3063 en adelante y se anota aquí y en el manual MAW §6.

### Variables de entorno

Las únicas que existen son `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`,
`POSTGRES_PASSWORD` (solo la lee docker-compose), `APP_PORT` y `TZ`. El contrato
comentado está en [`../.env.example`](../.env.example).

No hay secreto de sesión (las sesiones son opacas y viven en la BD), no hay cron por
HTTP, no hay carga de archivos, no hay SMTP ni pasarela de pagos. Si alguien busca
esas variables, no están porque no aplican.

---

## 2. Deploy automático

Push a `main` ⇒ GitHub Actions ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)):

1. `npm ci`, `lint`, `typecheck`, `test`.
2. `docker buildx build --platform linux/amd64` **en el runner** (cache `type=gha`).
3. `docker save | gzip` → `imagen/pharmaweigh.tar.gz`.
4. `rsync` de `docker-compose.yml` y `deploy/` a `/opt/pharmaweigh`, y del tar a
   `/opt/pharmaweigh/imagen/`.
5. `ssh deploy@vps 'sudo -n /usr/local/sbin/pharmaweigh-deploy'` → `docker load`,
   `up -d db`, espera `pg_isready`, `node scripts/migrar.mjs`, `up -d app`,
   health local, `docker image prune -f`, borra el tar.
6. Verifica `https://pharmaweigh.appsoluciones.duckdns.org/api/salud` = 200.

**La imagen no se construye en el VPS a propósito.** Hay ~1 GiB de RAM libre y el
swap medio lleno: un `next build` allá tumba la máquina entera, con los otros 28
sitios adentro. Si alguien "arregla" el compose agregando un bloque `build:`, lo
está rompiendo.

Si el deploy falla, **la versión anterior sigue sirviendo**: las migraciones corren
en un contenedor `run --rm` antes de tocar el contenedor vivo, y `up -d app` solo
ocurre si las migraciones pasaron.

### Cuando cambian los scripts root

`deploy/deploy_remoto.sh`, `deploy/respaldo.sh`, `deploy/cron/pharmaweigh` y
`deploy/sudoers` viven en `/usr/local/sbin` y `/etc`, fuera del alcance del usuario
`deploy`. El deploy automático **no** los actualiza; de hecho el wrapper compara su
propio hash contra el del repo y aborta si difieren. Reinstalar desde local con
llave de admin:

```bash
cd ~/Developer/pharma-formweigh
bash deploy/instalar_wrapper.sh maw-vps
```

---

## 3. Deploy manual

Cuando Actions no sirve (GitHub caído, prisa, o hay que probar una imagen a mano):

```bash
# 1. En la máquina local, construir y empaquetar:
cd ~/Developer/pharma-formweigh
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://pharmaweigh.appsoluciones.duckdns.org \
  -t pharmaweigh:latest --load .
mkdir -p imagen
docker save pharmaweigh:latest | gzip -6 > imagen/pharmaweigh.tar.gz

# 2. Subir compose, deploy/ y la imagen:
rsync -rlptzv --delete --exclude-from=deploy/rsync-exclude.txt ./ deploy@31.220.109.7:/opt/pharmaweigh/
rsync -rlpt --partial imagen/pharmaweigh.tar.gz deploy@31.220.109.7:/opt/pharmaweigh/imagen/

# 3. Disparar el wrapper:
ssh deploy@31.220.109.7 'sudo -n /usr/local/sbin/pharmaweigh-deploy'
```

Si solo hace falta reiniciar sin imagen nueva:

```bash
ssh maw-vps
$CO restart app          # reinicio simple
$CO up -d --force-recreate app
```

Volver a una versión anterior: no hay registro de imágenes, así que el rollback es
**volver a desplegar el commit bueno** (Actions → Deploy VPS → Run workflow sobre
ese commit, o el deploy manual de arriba desde ese checkout). Si la imagen vieja
todavía está en el VPS (`docker images pharmaweigh`), se puede retaguear:

```bash
docker tag <id-de-la-imagen-vieja> pharmaweigh:latest && $CO up -d --force-recreate app
```

---

## 4. Logs y diagnóstico

```bash
$CO logs -f --tail=200 app      # aplicación
$CO logs --tail=100 db          # base de datos
$CO ps                          # estado y health
docker stats --no-stream        # RAM y CPU por contenedor

# nginx del host
tail -f /var/log/nginx/pharmaweigh.error.log
tail -f /var/log/nginx/pharmaweigh.access.log

# respaldos (van a syslog vía logger)
journalctl -t pharmaweigh-respaldo --since '7 days ago'
```

Consola de Postgres:

```bash
$CO exec -T db psql -U pharma pharmaweigh -c '\dt'
$CO exec -it db psql -U pharma pharmaweigh
```

---

## 5. Primera instalación

Paso a paso completo en [`../deploy/primera_instalacion.md`](../deploy/primera_instalacion.md):
carpetas y grupo, `.env` root 600, wrapper y sudoers, nginx, certbot, cron,
secretos de GitHub, primer deploy, migración inicial, seed demo y usuario admin.

Resumen de la secuencia: grupo y carpetas → `.env` → `instalar_wrapper.sh` →
nginx + certbot → secretos de GitHub → push a `main` → seed y admin → verificar.

Publicar un servicio nuevo en `maw-vps` requiere visto bueno de Fernando (manual
MAW §9): la restricción es la RAM, no el gusto.

---

### Estado real de la instalación (2026-09-18)

Hecha y verificada: grupo `pharmaweigh`, `/opt/pharmaweigh` con `.env` root 600 (la contraseña de Postgres se generó
en el VPS con `openssl rand`; no existe copia fuera), wrapper + respaldo + cron + sudoers, vhost nginx con certificado
de certbot, primer deploy por Actions en verde, primer `pg_dump` en `/opt/backups/pharmaweigh`.

- **Llave de deploy:** par ed25519 propio de este repo (comentario `github-actions-pharmaweigh` en
  `/home/deploy/.ssh/authorized_keys`). La privada solo vive en el secreto `VPS_SSH_KEY` de GitHub. Para rotarla:
  generar otra, agregar la pública, actualizar el secreto y borrar la línea vieja.
- **Credenciales de la demo:** `/opt/backups/pharmaweigh/CREDENCIALES_DEMO.txt` (root, 600); no están en el repo ni en
  ningún documento. Leerlas: `ssh maw-vps cat /opt/backups/pharmaweigh/CREDENCIALES_DEMO.txt`.
  **Nunca guardar nada a mano dentro de `/opt/pharmaweigh`:** el deploy hace `rsync --delete` y lo borra (así se perdió
  el primer archivo de credenciales el 2026-09-18; las 7 contraseñas se restablecieron ese día, con asiento en bitácora).
  Antes de un piloto con el cliente: crear sus usuarios reales con `crear-usuario.mjs` y desactivar los demo.
- **Consumo medido:** app 43 MiB / 384, db 38 MiB / 256. El VPS quedó con swap 6.9/8 GB tras el `docker load`:
  vigilar `free -h` (ver §7).

## 5 bis. Gestión de cuentas por consola

No hay pantalla para restablecer contraseñas, dar de baja ni desbloquear (pendiente de definir con el cliente,
`PLAN.md §13.7`). Se hace con `scripts/usuario.mjs`, que viaja en la imagen y deja asiento en la bitácora:

```bash
ssh maw-vps
cd /opt/pharmaweigh
CO="docker compose -f docker-compose.yml --env-file .env -p pharmaweigh"
$CO run --rm --no-deps app node scripts/usuario.mjs restablecer correo@dominio   # imprime la contraseña nueva UNA vez
$CO run --rm --no-deps app node scripts/usuario.mjs desactivar  correo@dominio   # cierra sus sesiones; conserva historial
$CO run --rm --no-deps app node scripts/usuario.mjs activar     correo@dominio
$CO run --rm --no-deps app node scripts/usuario.mjs desbloquear correo@dominio   # levanta el bloqueo de 15 min
$CO run --rm --no-deps app node scripts/crear-usuario.mjs correo@dominio "Nombre Apellido" ROL
```

Para fijar una contraseña concreta: `-e PHARMA_PASSWORD='…'` (mínimo 10 caracteres) después de `run`.

## 6. Respaldos y restauración

- `pg_dump` diario a las **03:40** (`/etc/cron.d/pharmaweigh` →
  `/usr/local/sbin/pharmaweigh-respaldo`).
- Salida: `/opt/backups/pharmaweigh/pharmaweigh_AAAA-MM-DD_HHMM.sql.gz`, `chmod 600`.
- Retención **14 días**. El dump se escribe a `.parcial` y se renombra al final, así
  que un dump interrumpido nunca se confunde con uno bueno.
- No hay volumen de archivos subidos que respaldar: toda la información está en Postgres.

Respaldo manual (hacerlo **siempre antes de una migración riesgosa**):

```bash
ssh maw-vps '/usr/local/sbin/pharmaweigh-respaldo && ls -lh /opt/backups/pharmaweigh | tail -5'
```

Bajar una copia a la máquina local:

```bash
scp maw-vps:/opt/backups/pharmaweigh/pharmaweigh_2026-09-18_0340.sql.gz ~/Descargas/
```

### Restaurar

El dump se genera con `--clean --if-exists`, así que **sobrescribe** el contenido
actual. Es destructivo: confirmar con Fernando antes de correrlo en producción.

```bash
ssh maw-vps
cd /opt/pharmaweigh
CO="docker compose -f docker-compose.yml --env-file .env -p pharmaweigh"

# 1. Bajar la app para que nadie escriba durante la restauración:
$CO stop app

# 2. Respaldo de lo que hay AHORA (por si la restauración es la equivocada):
/usr/local/sbin/pharmaweigh-respaldo

# 3. Restaurar:
zcat /opt/backups/pharmaweigh/pharmaweigh_2026-09-18_0340.sql.gz \
  | $CO exec -T db psql -U pharma -v ON_ERROR_STOP=1 pharmaweigh

# 4. Levantar y verificar:
$CO up -d app
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3062/api/salud
```

Si el cliente termina el servicio, se le entrega el respaldo completo sin costo: los
datos son suyos (manual MAW §8).

---

## 7. Incidentes frecuentes

### `/api/salud` devuelve 503 ⇒ la base de datos no responde

La ruta contesta 200 si Postgres responde y 503 si no. Es siempre la BD.

```bash
$CO ps                    # ¿está `db` arriba y healthy?
$CO logs --tail=80 db
$CO exec -T db pg_isready -U pharma -d pharmaweigh
```

Causas en orden de probabilidad:

1. **`db` reiniciándose por OOM** — ver el incidente de RAM abajo. `docker inspect
   pharmaweigh-db-1 --format '{{.State.OOMKilled}}'` lo confirma.
2. **Contraseña desfasada** — se cambió `POSTGRES_PASSWORD` en el `.env` después del
   primer arranque. El volumen `pgdata` conserva la vieja. Se arregla con
   `ALTER ROLE pharma WITH PASSWORD '<nueva>';` dentro de `psql`, no borrando el volumen.
3. **Disco lleno** — Postgres se niega a escribir. Ver abajo.

### El VPS "se cayó" ⇒ casi siempre es RAM + swap agotada

No es la red ni el disco. Diagnóstico en este orden (manual MAW §6):

```bash
ping -c3 31.220.109.7
nc -z 31.220.109.7 22
ssh maw-vps 'uptime; free -h; df -h /'
ssh maw-vps 'ps -eo comm --no-headers | sort | uniq -c | sort -rn | head'
ssh maw-vps 'dmesg -T | grep -i -m20 "out of memory"'
```

Si `free -h` muestra swap al tope y la carga por los cielos, hay que bajar algo.
PharmaWeigh está capado en 640 MiB entre sus dos contenedores; si el culpable es
otro servicio, apagar **ese**. Para liberar rápido sin perder datos:

```bash
$CO stop app      # deja la BD viva, libera ~384 MiB
```

Si no entra SSH por IPv4, probar el alias IPv6 `maw-vps6`. `fail2ban` con
`banaction = ufw` bloquea **todos** los puertos, SSH incluido; la IP de casa debe
estar en `ignoreip`.

Nunca subir los `mem_limit` del compose "para que ya no truene": el límite es lo que
impide que PharmaWeigh se lleve al VPS entero.

### Disco lleno (anda al 92 %)

```bash
ssh maw-vps 'df -h /; docker system df'
ssh maw-vps 'docker image prune -f'          # imágenes huérfanas: lo normal
ssh maw-vps 'docker image prune -a -f'       # más agresivo: borra imágenes sin contenedor
ssh maw-vps 'ls -lh /opt/pharmaweigh/imagen' # ¿quedó un tar de un deploy fallido?
ssh maw-vps 'journalctl --vacuum-time=7d'    # logs de systemd
```

El wrapper ya corre `docker image prune -f` y borra el tar en cada deploy. Si aun
así se llena, revisar `/var/lib/docker/volumes` y los respaldos de los otros
proyectos, no solo los de PharmaWeigh.

### El deploy falla en "Verificar sitio público" pero el health local dio 200

Es nginx o el certificado, no la app.

```bash
ssh maw-vps 'nginx -t; systemctl status nginx --no-pager'
ssh maw-vps 'certbot certificates | grep -A3 pharmaweigh'
curl -sI https://pharmaweigh.appsoluciones.duckdns.org/api/salud
```

### El wrapper aborta con "deploy_remoto.sh cambió en el repo"

Es a propósito: el script que corre como root está desfasado del repo. Reinstalar
con `bash deploy/instalar_wrapper.sh` desde local con llave de admin.

### Las migraciones fallan

El deploy se detiene ahí y la versión vieja sigue sirviendo. Ver el error completo:

```bash
$CO run --rm --no-deps app node scripts/migrar.mjs
```

Corregir la migración en el repo y volver a desplegar. No editar el esquema a mano
en `psql`: deja la tabla de control de Drizzle mintiendo sobre el estado real.

---

## 8. Dar de baja el despliegue viejo (Vercel + Neon)

PharmaWeigh vivía en Vercel con base de datos en Neon. Con el VPS en operación, ese
despliegue queda duplicado: mismo producto, dos bases de datos que se van separando
en silencio, y alguien puede seguir capturando pesajes en la vieja.

> **Estado al 2026-09-18** (autorizado por Fernando ese día). Ejecutados los pasos 2, 4 y 5, todos reversibles:
> - **2 Respaldo:** `/opt/backups/pharmaweigh/neon_pharmaweigh_final_2026-09-18.sql.gz` (root 600, 10 tablas, íntegro).
>   No entra en la retención de 14 días (otro prefijo). Solo contenía datos demo corruptos: **no se migró nada** (ADR-010).
> - **4 Redirección:** `pharma-formweigh.vercel.app` responde 308 → sitio nuevo en todas las rutas (incluidas las
>   `/api/*` que antes respondían sin sesión). Los despliegues antiguos solo son alcanzables tras el SSO de Vercel.
> - **5 Desconexión:** Git desconectado del proyecto de Vercel (ningún push lo reemplaza) y el recurso Neon
>   `neon-aquamarine-car` desconectado del proyecto (0 variables de entorno).
>
> **Pendiente (pasos 6–7), no antes del 2026-10-19:** `vercel integration-resource remove neon-aquamarine-car` y
> `vercel project rm pharma-formweigh`, ambos con `--scope mawsoluciones-projects`. Son irreversibles: confirmar antes
> que el respaldo del paso 2 sigue ahí. Para revertir lo hecho: `vercel git connect` y
> `vercel integration-resource` (reconectar) + redeploy de un commit anterior.

Orden sugerido, sin prisa y con vuelta atrás en cada paso:

1. **Congelar** — avisar a los usuarios la fecha de corte y quitar el enlace viejo
   de donde esté publicado.
2. **Respaldar Neon** — `pg_dump` completo de la base de Neon y guardarlo junto a los
   respaldos del VPS. Este archivo se conserva aunque se borre todo lo demás.
3. **Migrar datos reales**, si los hay, del dump de Neon al Postgres del VPS, y
   verificar contra el sistema en producción (conteos por tabla, últimas órdenes).
4. **Redirigir** — dejar el proyecto de Vercel sirviendo una redirección 301 a
   `https://pharmaweigh.appsoluciones.duckdns.org` durante un par de semanas, para
   quien tenga el enlace viejo guardado.
5. **Desconectar integraciones** — quitar la integración de Neon en Vercel y las
   variables de entorno del proyecto.
6. **Pausar antes de borrar** — suspender el proyecto de Vercel y poner la base de
   Neon en pausa. Esperar al menos un ciclo de facturación con todo apagado y nadie
   reclamando.
7. **Borrar** — eliminar el proyecto de Vercel y el de Neon. Confirmar que el
   respaldo del paso 2 sigue existiendo y se puede restaurar.
8. **Limpiar el repo** — quitar `.vercel/`, el archivo de configuración de Vercel si
   queda alguno, y cualquier referencia a Neon en documentación y variables.

Mientras tanto, el `.vercel/` local está en `.gitignore` y no afecta al despliegue
del VPS.

---

## 9. Contactos y notas

- Mensualidad del cliente: cubre hosting, respaldos y soporte. Alcance nuevo se
  cotiza aparte a la misma tarifa (manual MAW §8).
- Los datos son del cliente: al terminar el servicio se entrega respaldo completo
  sin costo.
- Norma de referencia: `~/Developer/maw-metodo/MANUAL_DELEGACION.md`, §6 (despliegue)
  y §8 (operación y soporte).
