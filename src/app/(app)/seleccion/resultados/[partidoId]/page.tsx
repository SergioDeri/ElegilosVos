// Detalle del resultado de la Votación de un Partido de la Selección
// (Selección, ticket 10): 11 Elegido y Gran Ausente final, con el 11 Real y
// las Coincidencias del Hincha (ticket 11).
import Link from "next/link";
import { notFound } from "next/navigation";
import { cierreDeVotacion } from "@/domain/calendario";
import { formatearHoraUy } from "@/domain/comun/horario";
import { NOMBRE_SELECCION } from "@/domain/comun/textos";
import { SELECCION } from "@/domain/comun/tipos";
import { RUTA_SELECCION } from "@/lib/auth/rutas";
import { requerirHinchada } from "@/lib/auth/sesion";
import { leerGranAusenteFinal } from "@/lib/cierre/gran-ausente";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarJugadores, cargarMisJugadores, cargarOnceReal, cargarPartido, cargarResultado } from "../../../resultados/_resultados/datos";
import { EncabezadoPartido } from "../../../resultados/_resultados/vista-resultado";
import { ResultadoDeLaSeleccion } from "../_resultados/resultado-de-la-seleccion";

export default async function PaginaResultadoDeLaSeleccion({ params }: PageProps<"/seleccion/resultados/[partidoId]">) {
  const { partidoId } = await params;
  await requerirHinchada();
  const supabase = await crearClienteServidor();
  const ahora = new Date();

  const partido = await cargarPartido(supabase, SELECCION, partidoId);
  if (!partido) notFound();

  const cierre = cierreDeVotacion(partido.inicio);
  // Lee el resultado aunque el cierre (según el inicio) no haya llegado: un
  // Partido postergado después del cierre conserva su 11 Elegido.
  const [resultado, jugadores, misJugadores, onceReal] = await Promise.all([
    cargarResultado(supabase, partido, ahora),
    cargarJugadores(supabase, SELECCION),
    cargarMisJugadores(supabase, partido.id),
    cargarOnceReal(supabase, partido.id),
  ]);
  const final = resultado ? await leerGranAusenteFinal(supabase, partido.id) : null;

  return (
    <main>
      <p>
        <Link href={`${RUTA_SELECCION}/resultados`}>Volver a los resultados de la {NOMBRE_SELECCION}</Link>
      </p>
      <h1>11 Elegido</h1>
      <EncabezadoPartido club={NOMBRE_SELECCION} partido={partido} />
      {resultado || ahora.getTime() >= cierre.getTime() ? (
        <ResultadoDeLaSeleccion
          partido={partido}
          resultado={resultado}
          jugadores={jugadores}
          granAusente={final?.granAusente ?? null}
          misJugadores={misJugadores}
          onceReal={onceReal}
        />
      ) : (
        <p role="status">La Votación de este Partido cierra el {formatearHoraUy(cierre)}. El 11 Elegido sale al cierre.</p>
      )}
    </main>
  );
}
