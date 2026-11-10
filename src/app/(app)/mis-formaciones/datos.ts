// Lecturas de "Mis formaciones": el histórico de las Alineaciones del Hincha
// de la sesión. Con el cliente del usuario: RLS solo deja leer las propias.
import "server-only";
import type { Alineacion } from "@/domain/editor";
import { alineacionDesdeFila, COLUMNAS_ALINEACION } from "@/domain/armado";
import type { ClubId } from "@/domain/comun/tipos";
import { NOMBRE_RIVAL_DESCONOCIDO } from "@/domain/comun/textos";
import type { crearClienteServidor } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export interface MiFormacion {
  partidoId: string;
  inicio: Date;
  rival: string;
  cancelado: boolean;
  alineacion: Alineacion;
}

/** Las Alineaciones del Hincha en Partidos de su Club, del Partido más nuevo al más viejo. */
export async function cargarMisFormaciones(supabase: Cliente, hinchaId: string, club: ClubId): Promise<MiFormacion[]> {
  const { data, error } = await supabase
    .from("alineacion")
    .select(`${COLUMNAS_ALINEACION}, partido!inner(id, inicio, estado, club_id, rival(nombre))`)
    .eq("hincha_id", hinchaId)
    .eq("partido.club_id", club);
  if (error) throw error;
  return data
    .map((fila) => ({
      partidoId: fila.partido.id,
      inicio: new Date(fila.partido.inicio),
      rival: fila.partido.rival?.nombre ?? NOMBRE_RIVAL_DESCONOCIDO,
      cancelado: fila.partido.estado === "cancelado",
      alineacion: alineacionDesdeFila(fila),
    }))
    .sort((a, b) => b.inicio.getTime() - a.inicio.getTime());
}
