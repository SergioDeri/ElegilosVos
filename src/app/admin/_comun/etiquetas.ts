// Textos del backoffice para los valores del dominio. Los compartidos con la
// app (Club, Disponibilidad) están en @/domain/comun/textos.
import type { PosicionNatural } from "@/domain/comun/tipos";

export const ETIQUETA_POSICION: Record<PosicionNatural, string> = {
  ARQ: "Arquero",
  DEF: "Defensa",
  MED: "Mediocampista",
  DEL: "Delantero",
};
