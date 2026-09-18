# Marca — PharmaWeigh

Fuente de verdad: `src/app/globals.css` (tokens), `src/components/sidebar.tsx`, `src/app/login/page.tsx`, `src/app/(app)/dispensado/[ordenId]/page.tsx`, `src/app/(app)/inventario/page.tsx`, `src/app/(app)/ordenes/page.tsx`.

Este documento describe la marca **tal como está hoy en la app**. Todo lo de abajo está verificado en el código. Si cambia el código, se cambia aquí.

## Tokens de color (`:root` en `globals.css`)

| Token | Hex | Equivalente Tailwind | Uso en la app |
|---|---|---|---|
| `--background` | `#f8fafc` | slate-50 | fondo de página (`body`) |
| `--foreground` | `#0f172a` | slate-900 | texto principal |
| `--primary` | `#1e40af` | blue-800 | acento principal de marca |
| `--primary-light` | `#3b82f6` | blue-500 | acento secundario |
| `--success` | `#16a34a` | green-600 | éxito / dentro de tolerancia |
| `--warning` | `#d97706` | amber-600 | advertencia / cerca del límite |
| `--danger` | `#dc2626` | red-600 | error / fuera de tolerancia |
| `--sidebar-bg` | `#1e293b` | slate-800 | fondo de la barra lateral |
| `--sidebar-text` | `#e2e8f0` | slate-200 | texto de la barra lateral |

Nota: los tokens definen la paleta, pero **las pantallas usan clases utilitarias de Tailwind directamente** (`bg-slate-800`, `bg-blue-600`, `text-green-700`…). No hay un mapeo token → clase; la tabla de arriba dice a qué color corresponde cada token.

## Tipografía

- **Geist Sans** vía `next/font/google`, variable `--font-geist-sans`, expuesta en `@theme` como `--font-sans`. Es la única fuente cargada.
- `globals.css` declara también `--font-mono: var(--font-geist-mono)`, pero **Geist Mono no está cargada** en `src/app/layout.tsx`: cualquier uso de `font-mono` cae al monoespaciado del sistema. Es una inconsistencia pendiente, no una decisión.
- `body` usa `font-family: var(--font-sans), Arial, Helvetica, sans-serif` y la clase `antialiased`.

## Barra lateral (`sidebar.tsx`)

- Fondo `bg-slate-800`, texto `text-slate-200`, ancho fijo `w-64`, separadores `border-slate-700`.
- Logotipo: cuadro `w-10 h-10 bg-blue-600 rounded-lg` con el ícono de matraz en blanco; wordmark **PharmaWeigh** en `text-white font-bold`, bajada "Control de Producción" en `text-xs text-slate-400`.
- Ítem de menú activo: `bg-blue-600 text-white`. Inactivo: `text-slate-300`, con `hover:bg-slate-700 hover:text-white`.
- Pie: avatar con la inicial del usuario sobre `bg-slate-600`, nombre en `text-white`, rol en `text-xs text-slate-400`.
- El menú se filtra por rol (`MENU` + `tienePermiso` en `src/lib/auth/permisos.ts`): cada rol solo ve sus módulos.

## Acceso (`login/page.tsx`)

Fondo degradado `bg-gradient-to-br from-blue-900 to-slate-900`, tarjeta blanca `rounded-2xl shadow-2xl`, ícono sobre `bg-blue-100` con trazo `text-blue-700`, botón primario `bg-blue-700` con `hover:bg-blue-800`, foco de campos `focus:ring-blue-500`. Los campos usan `text-lg` porque se operan desde tableta en planta.

## Semántica del color

El color **no es decorativo**: en las pantallas de piso significa si se puede o no continuar.

### Semáforo de pesaje (`dispensado/[ordenId]/page.tsx`)

Los límites salen de la receta: `min = objetivo × (1 + toleranciaMin/100)`, `max = objetivo × (1 + toleranciaMax/100)`, y la franja de precaución es el 10 % del ancho del rango en cada extremo.

| Estado | Color | Significado | Efecto |
|---|---|---|---|
| `ok` | verde (`bg-green-50` / `border-green-500` / `text-green-700`) | dentro de tolerancia | confirmar habilitado |
| `warning` | ámbar (`bg-yellow-50` / `border-yellow-500` / `text-yellow-700`) | dentro de tolerancia pero cerca de un límite | confirmar habilitado |
| `low` / `high` | rojo (`bg-red-50` / `border-red-500` / `text-red-700`) | por debajo del mínimo o por encima del máximo | **confirmar deshabilitado** |
| `none` | gris (`bg-gray-100` / `border-gray-300`) | aún no se captura peso | confirmar deshabilitado |

Los tres círculos del semáforo (rojo, ámbar, verde) se encienden con `shadow-lg` sobre el estado vigente y quedan atenuados (`bg-*-200`) los demás.

### Estado de lote (`inventario/page.tsx`)

| Estado | Color | Lectura |
|---|---|---|
| `APROBADO` | verde 100/800 | liberado, es el único que se puede dispensar |
| `CUARENTENA` | amarillo 100/800 | retenido |
| `RECHAZADO` | rojo 100/800 | no usar |
| `CADUCADO` | rojo 200/900 | no usar, vencido |
| `AGOTADO` | gris 100/800 | sin existencia |

### Estado de orden (`ordenes/page.tsx`, `dispensado/page.tsx`)

| Estado | Color |
|---|---|
| `PENDIENTE` | amarillo 100/800 |
| `EN_PROCESO` | azul 100/800 |
| `DISPENSADO` | verde 100/800 |
| `EN_PRODUCCION` | morado 100/800 |
| `COMPLETADA` | verde 200/900 |
| `CANCELADA` | rojo 100/800 |

### Otros usos con significado

- **Material peligroso**: la tarjeta del ingrediente pasa a `border-red-400 bg-red-50` y muestra una banda `bg-red-600 text-white`. Un ingrediente normal es `border-blue-200 bg-white`.
- **Avance**: barra y pasos en `bg-blue-500` para el paso en curso (con `animate-pulse`), `bg-green-500` para lo ya dispensado o firmado, `bg-gray-200` para lo pendiente.
- **Fase firmada**: fondo `bg-green-50`, borde `border-green-300`, texto tachado en verde.
- **Errores de validación de lote**: `bg-red-50 border-red-200 text-red-700`.

Regla general: **verde = terminado o dentro de especificación · ámbar = atención, aún permitido · rojo = bloqueado o prohibido · azul = acción en curso o elemento interactivo · gris = inactivo o sin dato**.

## Documentos

- Manuales: `docs/manual/pharma_estilo.tex` replica esta paleta (`pharmaazul #1E40AF`, `pharmablue #2563EB`, `pharmagreen #16A34A`, `pharmayellow #D97706`, `pharmared #DC2626`, `pharmaslate #1E293B`), con Montserrat en lugar de Geist.
- Documentos comerciales: `docs/propuesta/maw_comun.tex`, mismos colores bajo los nombres corporativos de MAW (`azulcom`, `doradocom`, `grisbar`, `verdeok`, `ambarpend`, `rojonota`).
