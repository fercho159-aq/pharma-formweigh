/**
 * Fechas de calendario (caducidades). Puro: lo usan cliente y servidor.
 * Una caducidad "2027-12-31" se guarda como las 00:00 de ese día en la planta (México, UTC−6
 * fijo desde 2022) y se muestra en esa misma zona, para que nunca aparezca un día antes.
 * Criterio conservador: el lote deja de ser utilizable AL INICIAR su día de caducidad.
 * Si el cliente define "usable hasta el final del día", se cambia aquí (PLAN.md §13).
 */
export const ZONA_PLANTA = "America/Mexico_City";
const DESFASE_PLANTA = "-06:00";

export function fechaCalendarioADate(aaaaMmDd: string): Date {
  return new Date(`${aaaaMmDd}T00:00:00${DESFASE_PLANTA}`);
}

export function formatearFecha(valor: string | Date): string {
  return new Date(valor).toLocaleDateString("es-MX", { timeZone: ZONA_PLANTA });
}
