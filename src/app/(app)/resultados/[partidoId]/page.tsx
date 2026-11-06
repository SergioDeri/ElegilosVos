// Detalle del resultado de la Votación de un Partido del Club del Hincha.
import Link from "next/link";
import { notFound } from "next/navigation";
import { cierreDeVotacion } from "@/domain/calendario";
import { formatearHoraUy } from "@/domain/comun/horario";
import { requerirHincha } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarJugadores, cargarMisJugadores, cargarOnceReal, cargarPartido, cargarResultado } from "../_resultados/datos";
import { EncabezadoPartido, VistaResultado } from "../_resultados/vista-resultado";
import { NOMBRE_CLUB } from "@/domain/comun/textos";

export default async function PaginaResultadoDePartido({ params }: PageProps<"/resultados/[partidoId]">) {
  const { partidoId } = await params;
  const hincha = await requerirHincha();
  const club = NOMBRE_CLUB[hincha.clubFavorito];
  const supabase = await crearClienteServidor();
  const ahora = new Date();

  // RLS: solo Partidos de su Club.
  const partido = await cargarPartido(supabase, hincha.clubFavorito, partidoId);
  if (!partido) notFound();

  const cierre = cierreDeVotacion(partido.inicio);
  const [resultado, jugadores, misJugadores, onceReal] = await Promise.all([
    // Lee el resultado aunque el cierre (según el inicio) no haya llegado: un
    // Partido postergado después del cierre conserva su 11 Elegido.
    cargarResultado(supabase, partido, ahora),
    cargarJugadores(supabase, hincha.clubFavorito),
    cargarMisJugadores(supabase, partido.id),
    cargarOnceReal(supabase, partido.id),
  ]);

  return (
    <main>
      <p>
        <Link href="/resultados">Volver a los resultados</Link>
      </p>
      <h1>11 Elegido</h1>
      <EncabezadoPartido club={club} partido={partido} />
      {resultado || ahora.getTime() >= cierre.getTime() ? (
        <VistaResultado club={hincha.clubFavorito} partido={partido} resultado={resultado} jugadores={jugadores} misJugadores={misJugadores} onceReal={onceReal} />
      ) : (
        <p role="status">La Votación de este Partido cierra el {formatearHoraUy(cierre)}. El 11 Elegido sale al cierre.</p>
      )}
    </main>
  );
}
