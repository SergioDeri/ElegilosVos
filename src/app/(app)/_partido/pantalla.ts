// El Partido que va en pantalla para el Hincha (inicio y armado): lo elige el
// Calendario entre los Partidos de su Club (o de la Selección) que no terminaron.
import "server-only";
import { votacionesEnPantalla } from "@/domain/armado";
import { finDePartido } from "@/domain/calendario";
import { nombreDeClubOSeleccion } from "@/domain/comun/textos";
import { SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import type { HinchaConClub } from "@/lib/auth/sesion";
import { leerEscudoDelClub, leerPartidos, leerPlantel } from "@/lib/club/lecturas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarConOnceElegido } from "../_alineacion/datos";

function horaActual(): Date {
  return new Date();
}

async function cargar(de: ClubOSeleccion, partidoElegido?: string) {
  const club = nombreDeClubOSeleccion(de);
  const supabase = await crearClienteServidor();
  // Todo en paralelo: cada consulta es un viaje a Supabase.
  const [partidos, jugadores, escudoDelClub, congelados] = await Promise.all([
    leerPartidos(supabase, de),
    leerPlantel(supabase, de),
    leerEscudoDelClub(supabase, de),
    cargarConOnceElegido(supabase, de),
  ]);
  const ahora = horaActual();
  // Solo los Partidos que no terminaron pueden ir a la pantalla.
  const conOnceElegido = new Set(
    partidos
      .filter((p) => congelados.has(p.id) && finDePartido(p.inicio).getTime() > ahora.getTime())
      .map((p) => p.id),
  );
  // En la Selección puede haber dos Votaciones abiertas (fecha doble): el
  // Hincha elige el Partido; si no eligió (o eligió uno que no está), el primero.
  const opciones = votacionesEnPantalla(partidos, ahora, conOnceElegido, de).map((votacion) => ({
    votacion,
    partido: partidos.find((p) => p.id === votacion.partidoId)!,
  }));
  const elegida = opciones.find((o) => o.partido.id === partidoElegido) ?? opciones[0] ?? null;
  return {
    de,
    club,
    supabase,
    jugadores,
    escudoDelClub,
    ahora,
    conOnceElegido,
    opciones,
    votacion: elegida?.votacion ?? null,
    partido: elegida?.partido ?? null,
  };
}

/** El Partido del Club Favorito del Hincha que va en pantalla. */
export async function cargarPartidoEnPantalla(hincha: HinchaConClub) {
  return cargar(hincha.clubFavorito);
}

/**
 * Los Partidos de la Selección entre los que elige el Hincha (`opciones`: las
 * Votaciones abiertas, o el próximo Partido) y el elegido (`partidoElegido`,
 * por id; si no está entre las opciones, el primero).
 */
export async function cargarPantallaDeLaSeleccion(partidoElegido?: string) {
  return cargar(SELECCION, partidoElegido);
}

export type PantallaDePartido = Awaited<ReturnType<typeof cargar>>;
