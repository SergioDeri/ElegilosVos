// Textos del backoffice de Partidos.
import type { EstadoVotacion, Votacion } from "@/domain/calendario";
import { formatearHoraUy } from "@/domain/comun/horario";
import type { AvisoCambio, MotivoRechazo } from "@/domain/partidos";

export const ETIQUETA_VOTACION: Record<EstadoVotacion, string> = {
  pendiente: "Pendiente",
  abierta: "Abierta",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

export const TEXTO_RECHAZO: Record<MotivoRechazo, string> = {
  once_elegido:
    "La Votación de este Partido ya tiene 11 Elegido: el Partido no se puede borrar (sí postergar o cancelar; el 11 Elegido queda igual).",
  cancelado: "El Partido está cancelado: reactivalo para cambiarle el horario.",
  ya_cancelado: "El Partido ya está cancelado.",
  no_cancelado: "El Partido no está cancelado.",
  cierre_pasado: "Con ese inicio la Votación ya habría cerrado: elegí un inicio que deje la Votación abierta o pendiente.",
  con_alineaciones: "Hay Hinchas con Alineaciones guardadas para este Partido: no se puede borrar, cancelalo.",
};

/** Aviso de un Partido cuya Votación ya tiene resultado congelado. */
export const ONCE_CONGELADO = "El 11 Elegido ya quedó congelado; la votación no se reabre.";

export const NUNCA_ABRE =
  "La Votación nunca abriría (abre después de cerrar): se carga menos de 1 hora antes del inicio o, en un Club, empieza menos de 3 horas después del Partido anterior.";

function describirVotacion(v: Votacion | null): string {
  if (!v) return "se borra el Partido";
  if (v.estado === "anulada") return "queda anulada";
  return `${ETIQUETA_VOTACION[v.estado].toLowerCase()}, abre ${formatearHoraUy(v.abre)} y cierra ${formatearHoraUy(v.cierra)}`;
}

/** Avisos de `analizarCambio` en texto. `nombre(id)` describe un Partido. */
export function textosDeAvisos(avisos: readonly AvisoCambio[], nombre: (partidoId: string) => string): string[] {
  return avisos.map((a) => {
    switch (a.tipo) {
      case "nunca_abre":
        return `${nombre(a.partidoId)}: ${NUNCA_ABRE}`;
      case "afecta_votacion_abierta":
        return `${nombre(a.partidoId)}: la Votación está abierta y cambia (ahora: ${describirVotacion(a.antes)}; después: ${describirVotacion(a.despues)}). Las Alineaciones guardadas no se tocan.`;
      case "reabre_votacion":
        return `${nombre(a.partidoId)}: la Votación ya había cerrado y volvería a abrirse.`;
    }
  });
}
