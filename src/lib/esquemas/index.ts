/**
 * Esquemas Zod compartidos (cliente y servidor). El servidor SIEMPRE re-valida con
 * estos mismos esquemas en `ruta()`; la BD remata con NOT NULL / CHECK / UNIQUE.
 */
import { z } from "zod";

import { ESTADOS_LOTE, ROLES } from "@/lib/dominio/catalogos";

const texto = (max: number) => z.string().trim().min(1, "requerido").max(max);
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const idTexto = z.string().regex(/^[a-f0-9]{24}$/, "id inválido");
/** Cantidad positiva con 4 decimales a lo más y tope de numeric(14,4). */
const cantidadPositiva = z
  .number()
  .positive("debe ser mayor que 0")
  .max(9_999_999_999)
  .refine((n) => Math.abs(n * 10_000 - Math.round(n * 10_000)) < 1e-6, "máximo 4 decimales");

export const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

/** Política mínima de contraseña; la definitiva es PENDIENTE(cliente) — PLAN.md §13. */
export const esquemaPassword = z.string().min(10, "mínimo 10 caracteres").max(200);

export const esquemaCrearUsuario = z.object({
  nombre: texto(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: esquemaPassword,
  rol: z.enum(ROLES),
  badge: opcional(60),
});

export const esquemaCrearMaterial = z.object({
  codigo: texto(40),
  nombre: texto(160),
  descripcion: opcional(500),
  unidad: texto(12),
  stockMinimo: z.number().min(0).max(9_999_999_999).default(0),
});

export const esquemaRecibirLote = z.object({
  numero: texto(60),
  materialId: idTexto,
  cantidad: cantidadPositiva,
  fechaCaducidad: z.coerce.date(),
  proveedor: texto(160),
  certificado: opcional(200),
});

export const esquemaCambiarEstadoLote = z.object({ estado: z.enum(ESTADOS_LOTE) });

const esquemaIngrediente = z
  .object({
    materialId: idTexto,
    orden: z.number().int().min(1).max(999),
    cantidadTarget: cantidadPositiva,
    toleranciaMin: z.number().min(-100).max(0),
    toleranciaMax: z.number().min(0).max(100),
    instrucciones: opcional(500),
    peligroso: z.boolean().default(false),
  });

export const esquemaCrearReceta = z
  .object({
    codigo: texto(40),
    nombre: texto(160),
    descripcion: opcional(500),
    rendimiento: cantidadPositiva,
    unidadRendimiento: texto(30),
    fases: z
      .array(
        z.object({
          nombre: texto(120),
          instrucciones: opcional(1000),
          ingredientes: z.array(esquemaIngrediente).min(1, "cada fase necesita al menos un ingrediente"),
        }),
      )
      .min(1, "la receta necesita al menos una fase"),
  })
  .refine(
    (r) => {
      const ordenes = r.fases.flatMap((f) => f.ingredientes.map((i) => i.orden));
      return new Set(ordenes).size === ordenes.length;
    },
    { message: "el orden de los ingredientes no puede repetirse", path: ["fases"] },
  );

export const esquemaCrearOrden = z.object({
  recetaId: idTexto,
  loteProducto: texto(60),
  cantidad: cantidadPositiva,
  prioridad: z.number().int().min(0).max(9).default(0),
});

export const esquemaValidarLote = z.object({
  codigoLote: texto(60),
  ordenId: idTexto,
  ingredienteId: idTexto,
});

/** El cliente SOLO manda qué pesó y de qué lote; target, fase, paso y tolerancia los calcula el servidor. */
export const esquemaRegistrarDispensado = z.object({
  ordenId: idTexto,
  ingredienteId: idTexto,
  loteId: idTexto,
  cantidadReal: cantidadPositiva,
});

export const esquemaFirmarFase = z.object({
  ordenId: idTexto,
  faseId: idTexto,
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});
