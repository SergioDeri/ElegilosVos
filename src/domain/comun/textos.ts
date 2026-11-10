// Textos para mostrar los valores del dominio compartidos (Club, Selección, Disponibilidad).
import type { ClubId, ClubOSeleccion, Disponibilidad } from "./tipos";

export const NOMBRE_CLUB: Record<ClubId, string> = { penarol: "Peñarol", nacional: "Nacional" };

export const NOMBRE_SELECCION = "Selección";

/** Nombre para mostrar de un Club o de la Selección. */
export function nombreDeClubOSeleccion(clubOSeleccion: ClubOSeleccion): string {
  return clubOSeleccion === "seleccion" ? NOMBRE_SELECCION : NOMBRE_CLUB[clubOSeleccion];
}

export const NOMBRE_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  disponible: "Disponible",
  lesionado: "Lesionado",
  suspendido: "Suspendido",
  no_disponible: "No disponible",
};

/** Nombre a mostrar cuando no se puede leer el del Rival de un Partido. */
export const NOMBRE_RIVAL_DESCONOCIDO = "Rival";
