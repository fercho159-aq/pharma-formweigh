import { randomBytes } from "node:crypto";

/** Identificador opaco de 24 hex (96 bits). */
export function generarId(): string {
  return randomBytes(12).toString("hex");
}
