# PharmaWeigh

Sistema de dispensado (pesaje de materias primas) para producción farmacéutica. Guía al operario paso a paso:
escanea el lote, valida que sea el material correcto, aprobado y vigente, compara el peso contra la tolerancia
de la receta, exige firma electrónica de un supervisor por cada fase y deja bitácora inmutable de todo
(audit trail estilo 21 CFR Part 11).

Módulos: órdenes de producción, estación de dispensado, recetas y fases, inventario (materiales y lotes con
máquina de estados cuarentena → aprobado / rechazado), usuarios y roles, auditoría y generación de códigos
de barras para impresión.

## Stack

- Next.js 16 (App Router) y React 19
- TypeScript en modo estricto
- Tailwind CSS 4
- PostgreSQL con Drizzle ORM
- Zod para validación (los mismos esquemas en cliente y servidor)
- Vitest para las pruebas del dominio

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Sirve la compilación de producción |
| `npm run lint` | ESLint sobre todo el repo |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run db:generate` | Genera la migración a partir del esquema Drizzle |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Carga los catálogos y datos base |
| `npm run crear-usuario` | Da de alta un usuario de forma interactiva |

Los comandos de base de datos leen `.env.local`. No hay credenciales en el repo ni en la pantalla de acceso:
el primer usuario se crea con `npm run crear-usuario`.

## Documentación

- [`PLAN.md`](PLAN.md) — alcance, reglas del dominio, decisiones y pendientes
- [`CLAUDE.md`](CLAUDE.md) — convenciones para trabajar en este repo
- [`docs/OPERACION.md`](docs/OPERACION.md) — despliegue y operación
- [`docs/DECISIONES.md`](docs/DECISIONES.md) — registro de decisiones técnicas (ADR)
- `docs/manual/` — manuales por rol
