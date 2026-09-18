/** Catálogos del dominio. Archivo puro (sin BD ni Node): lo importan cliente, servidor y el esquema. */
export const ROLES = ["ADMIN", "SUPERVISOR", "OPERARIO", "DESARROLLO", "CALIDAD", "ALMACEN", "AUDITOR"] as const;
export const ESTADOS_LOTE = ["CUARENTENA", "APROBADO", "RECHAZADO", "AGOTADO", "CADUCADO"] as const;
export const ESTADOS_ORDEN = ["PENDIENTE", "EN_PROCESO", "DISPENSADO", "COMPLETADA", "CANCELADA"] as const;

export type Rol = (typeof ROLES)[number];
export type EstadoLote = (typeof ESTADOS_LOTE)[number];
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];
