// El Partido que va en pantalla para el Hincha (inicio y armado): lo elige el
// Calendario entre los Partidos de su Club que no terminaron.
import "server-only";
import { votacionEnPantalla } from "@/domain/armado";
import { finDePartido } from "@/domain/calendario";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import type { HinchaConClub } from "@/lib/auth/sesion";
import { leerEscudoDelClub, leerPartidos, leerPlantel } from "@/lib/club/lecturas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarConOnceElegido } from "../_alineacion/datos";

function horaActual(): Date {
  return new Date();
}

export async function cargarPartidoEnPantalla(hincha: HinchaConClub) {
  const club = NOMBRE_CLUB[hincha.clubFavorito];
  const supabase = await crearClienteServidor();
  // Todo en paralelo: cada consulta es un viaje a Supabase.
  const [partidos, jugadores, escudoDelClub, congelados] = await Promise.all([
    leerPartidos(supabase, hincha.clubFavorito),
    leerPlantel(supabase, hincha.clubFavorito),
    leerEscudoDelClub(supabase, hincha.clubFavorito),
    cargarConOnceElegido(supabase, hincha.clubFavorito),
  ]);
  const ahora = horaActual();
  // Solo los Partidos que no terminaron pueden ir a la pantalla.
  const conOnceElegido = new Set(
    partidos
      .filter((p) => congelados.has(p.id) && finDePartido(p.inicio).getTime() > ahora.getTime())
      .map((p) => p.id),
  );
  const votacion = votacionEnPantalla(partidos, ahora, conOnceElegido);
  const partido = votacion ? partidos.find((p) => p.id === votacion.partidoId)! : null;
  return { club, supabase, jugadores, escudoDelClub, ahora, conOnceElegido, votacion, partido };
}
