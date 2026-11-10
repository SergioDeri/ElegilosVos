// Resultados de la Selección (Selección, ticket 10): el 11 Elegido y el Gran
// Ausente final del último Partido de la Selección cuya Votación cerró (con
// el 11 Real y las Coincidencias del Hincha: ticket 11), y el
// historial (en una fecha doble, un resultado por Partido, cada uno con su
// detalle en /seleccion/resultados/<partidoId>). Un solo resultado con los
// votos de todos los Hinchas: lo ve cualquier Hincha, con Club o sin Club.
import Link from "next/link";
import { NOMBRE_SELECCION } from "@/domain/comun/textos";
import { SELECCION } from "@/domain/comun/tipos";
import { RUTA_SELECCION } from "@/lib/auth/rutas";
import { requerirHinchada } from "@/lib/auth/sesion";
import { leerGranAusenteFinal } from "@/lib/cierre/gran-ausente";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  cargarHistorial,
  cargarJugadores,
  cargarMisJugadores,
  cargarOnceReal,
  cargarResultado,
  cargarUltimoPartidoCerrado,
} from "../../resultados/_resultados/datos";
import { EncabezadoPartido, Historial } from "../../resultados/_resultados/vista-resultado";
import { ResultadoDeLaSeleccion } from "./_resultados/resultado-de-la-seleccion";

export default async function PaginaResultadosDeLaSeleccion() {
  await requerirHinchada();
  const supabase = await crearClienteServidor();
  const ahora = new Date();

  const partido = await cargarUltimoPartidoCerrado(supabase, SELECCION, ahora);
  // El cierre a pedido (si hace falta) va antes del historial, para que lo incluya.
  const resultado = partido ? await cargarResultado(supabase, partido, ahora) : null;
  const [historial, jugadores, final, misJugadores, onceReal] = await Promise.all([
    cargarHistorial(supabase, SELECCION),
    cargarJugadores(supabase, SELECCION),
    partido && resultado ? leerGranAusenteFinal(supabase, partido.id) : Promise.resolve(null),
    partido ? cargarMisJugadores(supabase, partido.id) : Promise.resolve(null),
    partido ? cargarOnceReal(supabase, partido.id) : Promise.resolve(null),
  ]);

  return (
    <main>
      <p>
        <Link href={RUTA_SELECCION}>Volver a la Selección</Link>
      </p>
      <h1>11 Elegido de la {NOMBRE_SELECCION}</h1>
      {partido ? (
        <section aria-label="Último Partido">
          <EncabezadoPartido club={NOMBRE_SELECCION} partido={partido} />
          <ResultadoDeLaSeleccion
            partido={partido}
            resultado={resultado}
            jugadores={jugadores}
            granAusente={final?.granAusente ?? null}
            misJugadores={misJugadores}
            onceReal={onceReal}
          />
        </section>
      ) : (
        <p role="status">Todavía no cerró ninguna Votación de la {NOMBRE_SELECCION}.</p>
      )}
      <section aria-label="Historial">
        <h2>Historial</h2>
        <Historial club={NOMBRE_SELECCION} items={historial} actual={partido?.id} base={`${RUTA_SELECCION}/resultados`} />
      </section>
    </main>
  );
}
