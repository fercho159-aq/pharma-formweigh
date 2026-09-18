@AGENTS.md

# PharmaWeigh — reglas operativas

Control de **dispensado y pesaje de materias primas** para producción farmacéutica: inventario por lotes, recetas por fases,
órdenes, pesaje guiado con semáforo de tolerancia, firma electrónica por fase y bitácora.
Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Drizzle + Postgres 16 · `src/` · alias `@/*`.
Plan maestro: `PLAN.md`. Decisiones: `docs/DECISIONES.md`. Marca: `docs/BRAND.md`. Operación: `docs/OPERACION.md`.

## 1. Dominio (no inventar reglas)

- Roles: `ADMIN SUPERVISOR OPERARIO DESARROLLO CALIDAD ALMACEN AUDITOR`. Quién puede qué: **solo** `src/lib/auth/permisos.ts`
  (fuente: manuales por rol en `docs/manual/`, ADR-007). Auditor y Desarrollo consultan; pesan Operario/Supervisor/Admin;
  firman Supervisor/Calidad/Admin.
- Lote: entra en `CUARENTENA` → Calidad `APROBADO | RECHAZADO`; `APROBADO → CUARENTENA` para retener. `AGOTADO` lo pone el
  sistema al llegar a 0. Almacén recibe y retiene, **nunca aprueba**. Reglas: `src/lib/dominio/lotes.ts`.
- Pesaje válido = lote del material correcto + `APROBADO` + no caducado + cantidad suficiente + peso dentro de
  `target × cantidad de la orden` ± tolerancia %. Fuera de tolerancia **se rechaza**, no se registra con bandera.
- Orden: `PENDIENTE → EN_PROCESO → DISPENSADO → COMPLETADA` / `CANCELADA` (`src/lib/dominio/ordenes.ts`). Pasos en orden
  estricto; una fase completa espera firma y bloquea la siguiente (`src/lib/dominio/fases.ts`).
- Lo que el cliente no ha definido está en `PLAN.md §13` como `PENDIENTE(cliente)`. **No se supone: se pregunta.**
- El sistema NO está validado (CSV / IQ-OQ-PQ) ni certificado 21 CFR Part 11 / NOM-059. No afirmarlo en ningún texto.

## 2. Seguridad

- **Falla cerrada, tres capas** (ADR-003): `src/proxy.ts` → `ruta()` de `src/lib/api.ts` (sesión, permiso, Origin, Zod) → BD
  (`NOT NULL`, `CHECK`, `UNIQUE`). **Toda** ruta API nueva se escribe con `ruta({ permiso, esquema })`; las páginas con
  `exigirPermisoPagina`. Únicas rutas públicas: `/login`, `/api/auth/login`, `/api/salud`.
- **Validación doble:** esquemas Zod compartidos en `src/lib/esquemas/`; el servidor SIEMPRE re-valida.
- **El servidor recalcula todo** (ADR-004): del cliente solo se acepta qué pesó y de qué lote. Nunca target, tolerancia, fase, paso ni nombres.
- **Cantidades nunca en float** (ADR-005): `numeric(14,4)` + `src/lib/dominio/cantidades.ts`.
- Escrituras de negocio en **una transacción** con su asiento de `registrarAuditoria(…, tx)`. La bitácora es inmutable (trigger).
- Sesión opaca en BD + bcrypt 12 (ADR-002). Límite de intentos en login y firma. Errores al cliente sin detalles de BD.
- Cero secretos y cero contraseñas en código, seeds o pantallas. `.env.example` versionado. Prohibido recrear endpoints de seed.
- **Nunca** apuntar `.env.local` a una base con datos reales: migraciones, seed y E2E escriben.

## 3. Calidad

- TypeScript `strict`. Prohibido `any` sin comentario que lo justifique.
- Reglas de negocio = funciones **puras** en `src/lib/dominio/*` con prueba vitest sin BD. Orquestación con BD en `src/lib/servicios/*`.
- Mutaciones por route handlers con `ruta()` (ADR-008: app heredada con pantallas cliente).
- Migraciones solo por `npm run db:generate` (SQL propio: `drizzle-kit generate --custom`). Prohibido tocar el esquema a mano o crear tablas en runtime.
- Copy en **español de México**. Fechas con `Intl`/`toLocaleString("es-MX")`, zona `America/Mexico_City`.
- Conventional Commits. Cada decisión no obvia → `docs/DECISIONES.md` en el momento.
- "Terminado" = `lint + typecheck + test + build` en verde **y** `npm run test:e2e` contra BD desechable.

## 4. Marca

Ver `docs/BRAND.md`. Color con significado: azul = interacción, verde = dentro de tolerancia / aprobado, ámbar = precaución /
cuarentena, rojo = fuera de tolerancia / rechazado / bloqueo. El semáforo de pesaje no se usa como decoración.

## 5. Comandos

```bash
npm run dev · npm run lint · npm run typecheck · npm run test · npm run build
npm run db:generate     # nueva migración desde src/db/schema.ts
npm run db:migrate      # aplica /drizzle a DATABASE_URL de .env.local
npm run db:seed         # datos DEMO; contraseñas aleatorias impresas una vez (o PHARMA_DEMO_PASSWORD)
npm run crear-usuario -- correo@dominio "Nombre" ROL [badge]
npm run usuario -- restablecer|desactivar|activar|desbloquear correo@dominio
npm run test:e2e        # E2E_URL + E2E_PASSWORD; solo contra localhost y BD desechable
```
