# PLAN — PharmaWeigh

Versión 1.0 · 2026-09-18 · **Estado: BORRADOR — pendiente de aprobación de Fernando** (Método MAW §2 y §9).

> Este plan es **retroactivo**. El prototipo se construyó sin `PLAN.md`; el 2026-09-18 se auditó, se reescribió el núcleo
> (seguridad, datos, reglas) y se documentó aquí lo que el código y los manuales ya dicen. Lo que nadie ha confirmado
> está en §13 y **no se supuso**.

## 1. Contexto y decisiones confirmadas

PharmaWeigh guía al operario en el pesaje de materias primas de una orden de producción farmacéutica: escanea el lote,
valida que sea el material correcto, aprobado y vigente, compara el peso contra la tolerancia de la receta, exige firma
electrónica de un supervisor por fase y deja bitácora de todo.

**No hay en el repo respuestas literales de un cliente final.** Las únicas fuentes de reglas son:

| Fuente | Qué aporta | Fecha |
|---|---|---|
| Manuales por rol `docs/manual/Manual_*.tex` (7) | Qué hace y qué no hace cada rol; flujo lote → receta → orden → dispensado → firma | commits `16179e1`, `a318704` |
| `docs/propuesta/cotizacion.tex` | Alcance ofrecido (10 entregables); **precios en blanco** | — |
| Fernando, 2026-09-18, literal | «corrige todos los puntos que están mal… genera los documentos… Si gustas, es mejor migrarlo al VPS» | esta intervención |

Decisiones técnicas tomadas en la intervención: `docs/DECISIONES.md` ADR-001 a ADR-010.

## 2. Archivos de referencia (de qué proyecto MAW sale la base)

De `~/Developer/club-miniprecios`: `src/db/index.ts` (cliente Drizzle perezoso), `scripts/migrar.mjs`, `drizzle.config.ts`,
`next.config.ts` (cabeceras), `Dockerfile`, `docker-compose.yml`, `deploy/*`, `.github/workflows/*`, `docs/OPERACION.md`,
`docs/propuesta/maw_comun.tex`, estructura de `CLAUDE.md`. No se reutilizó better-auth (ADR-002).

## 3. Arquitectura

```
Navegador (tablet/PC de estación, lector de código de barras o cámara)
   │ HTTPS
nginx + certbot (host maw-vps) ── 127.0.0.1:3062
   │
Contenedor app: Next 16 standalone (Node 22)
   src/proxy.ts            sin cookie → /login o 401
   src/app/api/**          ruta(): sesión → permiso → Origin → Zod
   src/lib/servicios/*     transacciones (Drizzle)
   src/lib/dominio/*       reglas puras (sin BD) ← vitest
   │
Contenedor db: Postgres 16 (red interna, sin puerto publicado)
   CHECK / UNIQUE / trigger de bitácora inmutable
```

## 4. Estructura de carpetas

```
src/app/(app)/…            pantallas (cliente) + layout por sección con exigirPermisoPagina
src/app/api/…              route handlers; salud en /api/salud
src/db/schema.ts           esquema único · src/db/index.ts cliente
src/lib/dominio/           catalogos, cantidades, tolerancia, lotes, ordenes, fases, errores (+ *.test.ts)
src/lib/auth/              permisos (puro), sesion, password, limite, paginas
src/lib/servicios/         dispensado (pesaje, firma), tablero
src/lib/esquemas/          Zod compartido
src/lib/api.ts             envoltura ruta() · src/lib/auditoria.ts
drizzle/                   migraciones generadas
scripts/                   migrar.mjs, seed.mjs, crear-usuario.mjs, e2e.mjs
deploy/ · Dockerfile · docker-compose.yml · .github/workflows/
docs/                      DECISIONES, OPERACION, BRAND, manual/, propuesta/
```

## 5. Modelo de datos (`src/db/schema.ts`)

| Tabla | Propósito | Restricciones clave |
|---|---|---|
| `usuarios` | nombre, email único, `password_hash` bcrypt, `rol` enum, badge único, activo | — |
| `sesiones` | `token_hash` único, usuario, expiración, ip, user-agent | cascade al borrar usuario |
| `intentos_acceso` | fallos/éxitos de login y firma por clave (`email:` / `ip:`) | índice (tipo, clave, timestamp) |
| `materiales` | código único, unidad, stock mínimo | — |
| `lotes` | número único, material, cantidad, caducidad, proveedor, `estado` enum | `CHECK cantidad >= 0`, `CHECK inicial > 0` |
| `recetas` / `fases` / `ingredientes` | receta por fases; ingrediente con target y tolerancia % | único (receta, orden); `CHECK target > 0`, `tolMin <= 0 <= tolMax` |
| `ordenes_produccion` | folio por secuencia, receta, lote de producto, multiplicador, `estado` enum | `CHECK cantidad > 0` |
| `dispensados` | pesaje: orden, fase, **ingrediente**, lote, operario, target, real | **único (orden, ingrediente)** |
| `firmas_fase` | firma electrónica por fase | **único (orden, fase)** |
| `auditoria` | bitácora con IP | trigger: sin UPDATE / DELETE / TRUNCATE |

Cantidades `numeric(14,4)`, porcentajes `numeric(5,2)` (ADR-005).

## 6. Reglas de negocio (cada una en una función pura y probada)

| # | Regla | Módulo |
|---|---|---|
| 6.1 | Matriz de permisos por rol; falla cerrada | `auth/permisos.ts` |
| 6.2 | Rango de pesaje = target × cantidad de orden ± %; límites hacia adentro; semáforo con 10 % de margen ámbar | `dominio/tolerancia.ts` |
| 6.3 | Lote utilizable: existe, material correcto, APROBADO, vigente, cantidad suficiente | `dominio/lotes.ts · validarLoteParaDispensar` |
| 6.4 | Máquina de estados del lote y quién libera / quién retiene | `dominio/lotes.ts · validarCambioEstadoLote` |
| 6.5 | Máquina de estados de la orden; folio `ORD-#####` | `dominio/ordenes.ts` |
| 6.6 | Pasos en orden estricto; fase completa bloquea hasta firma; firma exige fase completa y anteriores firmadas; orden DISPENSADO al firmar todas | `dominio/fases.ts` |
| 6.7 | Aritmética exacta de cantidades | `dominio/cantidades.ts` |
| 6.8 | Firma = re-autenticación de SUPERVISOR/CALIDAD/ADMIN, con límite de intentos y bitácora de rechazos | `servicios/dispensado.ts · firmarFase` |

## 7. Rutas

Páginas: `/login`, `/` (dashboard), `/ordenes`, `/ordenes/[id]`, `/dispensado`, `/dispensado/[ordenId]`, `/recetas`,
`/inventario`, `/auditoria`, `/usuarios`, `/codigos`.
API: `auth/login`, `auth/logout`, `salud`, `usuarios`, `auditoria`, `ordenes`, `recetas`, `inventario/materiales`,
`inventario/materiales/buscar`, `inventario/lotes`, `inventario/lotes/[id]`, `dispensado/ordenes`, `dispensado/[ordenId]`,
`dispensado/validar-lote`, `dispensado/registrar`, `dispensado/firmar`. Eliminadas: `seed`, `seed-extra`, `seed-usuarios`.

## 8. Integraciones externas

Ninguna en esta fase. Lector de código de barras = teclado HID o cámara (`html5-qrcode`). **Báscula: no integrada**, el
peso se teclea (§13).

## 9. Seguridad

`CLAUDE.md §2` y ADR-002/003/004/006. Hallazgos que motivaron el rediseño: informe de auditoría del 2026-09-18
(cookie forjable, GET sin sesión, seeds públicos, 7 contraseñas por defecto en producción, SHA-256 sin sal).

## 10. Deploy

`docs/OPERACION.md` y ADR-009. maw-vps, `/opt/pharmaweigh`, puerto 3062, `pharmaweigh.appsoluciones.duckdns.org`,
imagen construida en Actions, respaldo `pg_dump` diario con 14 días.

## 11. Hitos

| Hito | Estado |
|---|---|
| H0 Prototipo en Vercel + Neon | hecho (commits hasta `16179e1`) — **no apto para producción** |
| H1 Núcleo seguro: datos, sesiones, permisos, reglas puras, transacciones, bitácora | hecho 2026-09-18 |
| H2 Verificación: lint, typecheck, unitarias, build, E2E local | hecho 2026-09-18 (ver §12) |
| H3 Deploy en maw-vps con CI, salud y respaldos | ver `docs/OPERACION.md` |
| H4 Manuales actualizados, propuesta, contrato, resumen ejecutivo | documentos generados; cifras `PENDIENTE(Fernando)` |
| H5 Respuestas del cliente a §13 → ajustes → piloto en planta | pendiente |

## 12. Verificación (cómo se demuestra que funciona)

1. `npm run lint && npm run typecheck && npm run test && npm run build` en verde (CI lo exige en cada PR y antes de cada deploy).
2. Unitarias sin BD de todas las reglas de §6 (`src/lib/**/*.test.ts`).
3. `npm run test:e2e` contra BD desechable: camino completo material → lote → aprobación → receta → orden → pesaje →
   firma → DISPENSADO, más los ataques del prototipo: cookie forjada, GET sin sesión, seed público, tolerancia mentida
   por el cliente, salto de fase, **ráfaga de 8 pesajes simultáneos → 1 aceptado**, stock nunca negativo, firma con rol
   sin facultad, doble firma, Origin ajeno, bloqueo tras 5 fallos, sesión cerrada inservible, 11 acciones en bitácora.
4. `/api/salud` = 200 con BD viva, 503 sin ella; lo usan Docker, el wrapper de deploy y el workflow.
5. **Falta (método MAW §5.4 y §5.6):** smoke test contra datos reales del cliente y validación contra un resultado
   conocido suyo (una orden ya pesada en papel). No hay cliente conectado todavía → §13.

## 13. Pendientes

### PENDIENTE(cliente) — reglas que el sistema hoy resuelve con el valor más conservador o heredado
1. **Segregación de funciones en la firma:** ¿puede firmar una fase la misma persona que la pesó (p. ej. un supervisor que dispensa)? Hoy no se bloquea.
2. **Fuera de tolerancia:** hoy el pesaje se rechaza. ¿Existe un flujo de desviación autorizada por Calidad?
3. **Quién aprueba lotes:** se aplicó el manual (Calidad, Supervisor, Admin; Almacén no). ¿Supervisor debe poder?
4. **Lotes:** ¿FEFO obligatorio (usar primero el que caduca antes)? ¿Se puede repartir un ingrediente entre dos lotes? ¿La caducidad vence al inicio o al final del día indicado (hoy se compara al instante exacto guardado)? ¿Quién y cuándo marca `CADUCADO`? ¿Hay re-análisis?
5. **Órdenes:** ¿quién pasa `DISPENSADO → COMPLETADA`? ¿quién cancela y qué pasa con el material ya pesado?
6. **Recetas:** versionado y aprobación de cambios; ¿una receta usada en órdenes puede editarse? (hoy no hay edición).
7. **Contraseñas y sesión:** política (hoy mínimo 10 caracteres), caducidad, cierre por inactividad (hoy 24 h fijas), bloqueo (hoy 5 fallos/15 min), alta/baja de usuarios y reinicio de contraseña (hoy solo por consola).
8. **Báscula:** marca/modelo/protocolo para captura automática del peso; hoy se teclea. Tara y pesaje por diferencia.
9. **Unidades:** ¿solo kg y L? ¿decimales requeridos por material (hoy 4)?
10. **Regulatorio:** alcance de validación (CSV, IQ/OQ/PQ), requisitos 21 CFR Part 11 / NOM-059 / NOM-164, retención de la bitácora, reportes impresos del dispensado (batch record).
11. **Datos maestros iniciales:** catálogo real de materiales, proveedores, recetas y usuarios; quién es la fuente de verdad (¿ERP?).
12. **Nombre del cliente y del producto en los textos.**

### PENDIENTE(Fernando)
1. Aprobar este `PLAN.md` y los ADR-001, 004, 005, 010 (cambian el modelo de datos).
2. Horas, tarifa, precio, mensualidad y forma de pago de `docs/propuesta/*` (hoy marcados como pendiente, sin cifras inventadas).
3. La cotización anterior afirma «21 CFR Part 11 ✓» y «disponibilidad 99.9 %»: no es verificable; decidir si se retira de lo ya enviado.
4. Dar de baja el proyecto de Vercel y la base Neon (expuso credenciales por defecto; ver `docs/OPERACION.md`).
5. Purgar del historial de git los binarios `gh` (48 MB) y `docs/tectonic` (54 MB): ya no están en el árbol, pero reescribir historia exige `push --force`.
