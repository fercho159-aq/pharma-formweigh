# Decisiones de arquitectura (ADR) — PharmaWeigh

Formato: **qué · por qué · alternativa descartada**. Una decisión nueva = un ADR nuevo; no se editan los viejos, se reemplazan con otro que lo diga.

---

## ADR-001 — Una sola capa de datos: Drizzle + postgres-js; se retira Prisma 8 rc y el `CREATE TABLE` en runtime

- **Qué:** el esquema vive en `src/db/schema.ts`; las migraciones salen de `npm run db:generate` a `/drizzle` y se aplican con `scripts/migrar.mjs`. Se eliminaron `prisma/`, `migrations/`, `src/prisma/`, `prisma.config.ts` y `src/lib/db.ts` (que creaba tablas y sembraba usuarios en la primera consulta de cada arranque).
- **Por qué:** convivían dos capas y ninguna mandaba: Prisma 8 **rc** estaba configurado pero nadie lo importaba, y el runtime usaba `pg` crudo con DDL dentro de la app. Prisma rc arrastraba 13 vulnerabilidades (8 altas) vía su tooling; tras retirarlo `npm audit --omit=dev` da 0. Drizzle + Postgres es la base probada de MAW (Club Mini Precios, Treca), con el mismo migrador y el mismo runbook.
- **Descartado:** (a) terminar la migración a Prisma 8 rc — versión candidata, sin historial en MAW; (b) dejar `pg` crudo con SQL a mano — viola "migraciones solo por generador" y no da tipos.

## ADR-002 — Sesiones opacas en BD + bcrypt; se retira la cookie base64 sin firma y SHA-256 sin sal

- **Qué:** la cookie `pharma-session` lleva 32 bytes aleatorios; la tabla `sesiones` guarda su SHA-256, el usuario y la expiración (24 h). `getSession()` lee de BD **rol y `activo` en cada petición**. Contraseñas con bcrypt costo 12. Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción.
- **Por qué:** el prototipo guardaba `{id,nombre,email,rol}` en base64 sin firma: se verificó en producción que una cookie escrita a mano con `rol: ADMIN` entraba sin login. Con token opaco no hay nada que falsificar ni secreto que rotar; cerrar sesión o desactivar un usuario surte efecto inmediato (en una firma electrónica eso importa). SHA-256 sin sal se rompe con tablas precomputadas.
- **Descartado:** (a) JWT/cookie firmada con HMAC — no revoca sin lista negra y el rol quedaría congelado hasta expirar; (b) better-auth (lo usa Club MP) — trae su propio modelo de usuario y aquí la firma electrónica necesita re-autenticar a un *segundo* usuario dentro de la sesión de otro; una tabla de 7 columnas es más auditable.

## ADR-003 — Falla cerrada en tres capas y una envoltura única para la API

- **Qué:** (1) `src/proxy.ts` corta sin cookie; (2) toda ruta pasa por `ruta()` (`src/lib/api.ts`): sesión → permiso del rol según la matriz única `PERMISOS` → `Origin` en mutaciones (anti-CSRF) → Zod; (3) la BD remata con `NOT NULL`, `CHECK`, `UNIQUE`. Las páginas usan `exigirPermisoPagina`. Límite de intentos en BD para login y firma: 5 fallos/15 min por correo, 30 por IP. Se borraron `/api/seed*`.
- **Por qué:** en el prototipo los `GET` no pedían sesión (producción entregaba usuarios, bitácora, fórmulas e inventario a cualquiera) y tres endpoints de seed aceptaban `POST` anónimo. Una envoltura única hace imposible "olvidar" el chequeo en una ruta nueva. El tope por IP es alto a propósito: en planta todas las estaciones comparten IP.
- **Descartado:** validar la sesión contra BD dentro del proxy — la documentación de Next 16 pide que el proxy no dependa de módulos compartidos; se deja como filtro barato y la autorización real vive junto al dato.

## ADR-004 — El servidor decide el pesaje; transacción única; idempotencia por índice único

- **Qué:** `POST /api/dispensado/registrar` recibe solo `{ordenId, ingredienteId, loteId, cantidadReal}`. Target, fase, paso, material y tolerancia salen de la BD; las reglas son funciones puras de `src/lib/dominio/`. Alta del dispensado + descuento del lote + estado de la orden + asiento de auditoría van en **una transacción** con `SELECT … FOR UPDATE` sobre la orden y el lote. `UNIQUE (orden_id, ingrediente_id)`, `UNIQUE (orden_id, fase_id)` en firmas, `CHECK (cantidad >= 0)` en lotes. Folio de orden por secuencia de Postgres.
- **Por qué:** el prototipo aceptaba `toleranciaOk`, `cantidadTarget` y `materialNombre` del navegador y no re-validaba lote, caducidad ni material: el semáforo era decorativo. En la base real había un paso registrado **8 veces en 4 s** por doble clic y un lote en **−15 kg**. `COUNT(*)+1` para el folio tenía condición de carrera.
- **Descartado:** confiar en el guard `registrando` del botón — protege de un dedo, no de dos pestañas ni de un `curl`.

## ADR-005 — Cantidades en `numeric(14,4)`; el dominio compara en diezmilésimas enteras

- **Qué:** kg/L en `numeric(14,4)`, tolerancias en `numeric(5,2)`. `cantidades.ts` convierte a enteros ×10 000 para comparar y restar; los límites de tolerancia se redondean **hacia adentro** del rango. El servidor entrega el `rango {target,min,max}` y la pantalla usa el mismo módulo puro para el semáforo.
- **Por qué:** `REAL` (float4) no representa 0.1 ni 3.51; en un límite de ±1 % sobre 0.05 kg el error de float decide si un pesaje pasa. Es la misma regla de MAW "dinero en centavos", aplicada a masa.
- **Descartado:** enteros en miligramos en la BD — las unidades son kg y L según material; `numeric` conserva la unidad del cliente y es exacto.

## ADR-006 — Bitácora inmutable por trigger y escrita en la misma transacción

- **Qué:** migración custom `0001_auditoria_inmutable.sql`: triggers que rechazan `UPDATE`, `DELETE` y `TRUNCATE` sobre `auditoria`. Cada asiento lleva IP y se inserta con el mismo `tx` de la operación. Se registran también `LOGIN_FALLIDO` y `FIRMA_RECHAZADA`. Se eliminó `resolveUserId`, que atribuía la acción al ADMIN cuando no encontraba al usuario.
- **Por qué:** en la base real había 15 dispensados y solo 2 asientos `DISPENSAR`, la columna `ip` nunca se llenaba y nada impedía editar la bitácora. Una bitácora que se puede editar no es evidencia.
- **Descartado:** "inmutable por convención" en el código — un `psql` o un bug lo rompe. Pendiente (no resuelto aquí): encadenado por hash o copia externa, para resistir a un superusuario de la BD.

## ADR-007 — Permisos tomados de los manuales por rol, en una matriz única

- **Qué:** `src/lib/auth/permisos.ts` es la única fuente (API, páginas y menú). Se tomó como regla lo que dicen los manuales entregados (`docs/manual/`): Calidad aprueba/rechaza lotes, Almacén recibe y puede retener en cuarentena pero **no** aprobar; Auditor y Desarrollo consultan; pesan Operario, Supervisor y Admin; firman Supervisor, Calidad y Admin.
- **Por qué:** el código y los manuales se contradecían (el API dejaba a Almacén aprobar su propio lote y a cualquier rol pesar). No se inventó nada: se eligió el documento que el cliente ya recibió. Lo que ningún documento define quedó como `PENDIENTE(cliente)` en `PLAN.md §13`.
- **Descartado:** conservar los permisos del código "porque así estaba".

## ADR-008 — Se conservan route handlers + páginas cliente (desviación del estándar MAW)

- **Qué:** las mutaciones siguen en `src/app/api/**` consumidas con `fetch`, no en server actions.
- **Por qué:** es una app heredada con ~3 000 líneas de pantallas cliente ya documentadas con capturas en 7 manuales. Reescribirlas a Server Components no corrige ningún riesgo: la seguridad quedó en `ruta()`, que re-valida todo igual que una server action.
- **Descartado:** reescritura completa de UI en esta intervención.

## ADR-009 — Despliegue en maw-vps; la imagen se construye en GitHub Actions, no en el VPS

- **Qué:** `/opt/pharmaweigh`, puerto **3062**, `pharmaweigh.appsoluciones.duckdns.org`, compose con app (384 MB máx.) + Postgres 16 (256 MB máx., `shared_buffers=64MB`). Actions construye `linux/amd64`, envía la imagen por SSH (`docker save | gzip`) y el wrapper root hace `docker load` → migrar → `up -d` → salud → `image prune`.
- **Por qué:** al medir (2026-09-18) el VPS tenía **1.0 GiB de RAM disponible, swap 4.9/8 GB y disco al 92 %** con 28 sitios. `next build` dentro del VPS pide 1–2 GB y es justo el escenario "el VPS se cae = RAM+swap agotada" del manual. En Vercel+Neon además dev/preview/prod compartían la misma base.
- **Descartado:** (a) patrón Club MP tal cual (build en el VPS) — riesgo para los otros 28 sitios; (b) registro GHCR — exige un token `read:packages` más en el VPS; el `.tar.gz` por SSH no agrega secretos.

## ADR-010 — Sin migración de datos desde Neon; la base nueva nace limpia

- **Qué:** la base del VPS se crea con migraciones y, para la demo, `scripts/seed.mjs` (contraseñas aleatorias impresas una vez). No se copian datos de Neon.
- **Por qué:** Neon solo tenía datos de demostración y estaban corruptos (stock negativo, 8 duplicados, dispensados sin fase, 7 contraseñas por defecto publicadas en la pantalla de login). No hay datos del cliente que preservar.
- **Descartado:** `pg_dump` de Neon + limpieza manual.
