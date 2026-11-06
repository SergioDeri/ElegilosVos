// Fecha de la imagen para compartir (ticket 16), en hora de Montevideo. Vive
// en el borde: el dominio (@/domain/compartir) la recibe ya formateada.
import { aHoraUyLocal, formatearHoraUy } from "@/domain/comun/horario";

/** `fecha` para mostrar y `dia` ("YYYY-MM-DD") para el nombre del archivo, en hora de Montevideo. */
export function fechaDeImagen(inicio: Date): { fecha: string; dia: string } {
  return { fecha: formatearHoraUy(inicio), dia: aHoraUyLocal(inicio).slice(0, 10) };
}
