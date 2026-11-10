// Lecturas de las pantallas de Convocatoria (servidor, cliente de la sesión
// del Admin: RLS con es_admin()).
import "server-only";
import { calcularVotaciones, type EstadoVotacion } from "@/domain/calendario";
import { SELECCION, type PosicionNatural } from "@/domain/comun/tipos";
import { leerConvocatorias, type ConvocatoriaCargada } from "@/lib/convocatoria/lecturas";
import type { crearClienteServidor } from "@/lib/supabase/server";
import { cargarPartidosDelClub } from "../_partidos/datos";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export interface ElegibleVista {
  id: string;
  nombre: string;
  posicionNatural: PosicionNatural;
  enPlantel: boolean;
}

export interface PartidoDeLaSeleccionVista {
  id: string;
  inicio: string;
  rivalNombre: string;
  cancelado: boolean;
  votacion: EstadoVotacion;
  /** La Convocatoria que ya se aplica a este Partido, o null. */
  convocatoriaId: string | null;
}

export interface DatosDeConvocatorias {
  elegibles: ElegibleVista[];
  partidos: PartidoDeLaSeleccionVista[];
  convocatorias: ConvocatoriaCargada[];
}

function horaActual(): Date {
  return new Date();
}

/** Elegibles (por nombre), Partidos de la Selección (por inicio) y Convocatorias cargadas. */
export async function cargarDatosDeConvocatorias(supabase: Cliente): Promise<DatosDeConvocatorias> {
  const [jugadores, partidos, convocatorias] = await Promise.all([
    supabase.from("jugador").select("id, nombre, posicion_natural, en_plantel").eq("club_id", SELECCION).order("nombre"),
    cargarPartidosDelClub(supabase, SELECCION),
    leerConvocatorias(supabase),
  ]);
  if (jugadores.error) throw jugadores.error;

  const deConvocatoria = new Map(convocatorias.flatMap((c) => c.partidos.map((p) => [p, c.id] as const)));
  const votaciones = new Map(calcularVotaciones(partidos, horaActual(), SELECCION).map((v) => [v.partidoId, v.estado]));
  return {
    elegibles: jugadores.data.map((j) => ({
      id: j.id,
      nombre: j.nombre,
      posicionNatural: j.posicion_natural,
      enPlantel: j.en_plantel,
    })),
    partidos: [...partidos]
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
      .map((p) => ({
        id: p.id,
        inicio: p.inicio.toISOString(),
        rivalNombre: p.rivalNombre,
        cancelado: p.estado === "cancelado",
        votacion: votaciones.get(p.id) ?? "pendiente",
        convocatoriaId: deConvocatoria.get(p.id) ?? null,
      })),
    convocatorias,
  };
}
