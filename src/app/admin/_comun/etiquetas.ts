// Textos del backoffice para los valores del dominio. Los compartidos con la
// app (Club, Disponibilidad) están en @/domain/comun/textos.
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { SELECCION, type ClubOSeleccion, type PosicionNatural } from "@/domain/comun/tipos";

/** "de Peñarol", "de Nacional" o "de la Selección", para los títulos ("Plantel de…"). */
export function deClubOSeleccion(clubOSeleccion: ClubOSeleccion): string {
  return clubOSeleccion === SELECCION ? "de la Selección" : `de ${NOMBRE_CLUB[clubOSeleccion]}`;
}

export const ETIQUETA_POSICION: Record<PosicionNatural, string> = {
  ARQ: "Arquero",
  DEF: "Defensa",
  MED: "Mediocampista",
  DEL: "Delantero",
};
