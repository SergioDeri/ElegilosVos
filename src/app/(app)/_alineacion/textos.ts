// Textos de la pantalla de armado.
import type { PosicionNatural } from "@/domain/comun/tipos";
import type { MotivoRechazo } from "@/domain/editor";

export const MENSAJE_DE_RECHAZO: Record<MotivoRechazo, string> = {
  puesto_fuera_del_esquema: "Ese Puesto no es de este Esquema.",
  jugador_desconocido: "Ese Jugador no está en el Plantel.",
  jugador_fuera_del_plantel: "Ese Jugador ya no está en el Plantel.",
  jugador_no_disponible: "Ese Jugador no está Disponible.",
  jugador_ya_colocado: "Ese Jugador ya está en la cancha.",
  arquero_fuera_del_arco: "Un arquero solo puede ir al arco.",
  arco_solo_para_arqueros: "Al arco solo pueden ir arqueros.",
  puesto_vacio: "Ese Puesto está vacío.",
};

export const POSICION: Record<PosicionNatural, string> = {
  ARQ: "ARQ",
  DEF: "DEF",
  MED: "MED",
  DEL: "DEL",
};
