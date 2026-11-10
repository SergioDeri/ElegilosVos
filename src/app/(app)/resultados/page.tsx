// 11 Elegido del último Partido cerrado del Club del Hincha, su Coincidencia
// y el historial de 11 Elegidos del Club (ticket 12).
import Link from "next/link";
import { requerirHincha } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  cargarHistorial,
  cargarJugadores,
  cargarMisJugadores,
  cargarOnceReal,
  cargarResultado,
  cargarUltimoPartidoCerrado,
} from "./_resultados/datos";
import { EncabezadoPartido, Historial, VistaResultado } from "./_resultados/vista-resultado";
import { NOMBRE_CLUB } from "@/domain/comun/textos";

export default async function PaginaResultados() {
  const hincha = await requerirHincha();
  const club = NOMBRE_CLUB[hincha.clubFavorito];
  const supabase = await crearClienteServidor();
  const ahora = new Date();

  const partido = await cargarUltimoPartidoCerrado(supabase, hincha.clubFavorito, ahora);
  // El cierre a pedido (si hace falta) va antes del historial, para que lo incluya.
  const resultado = partido ? await cargarResultado(supabase, partido, ahora) : null;
  const [historial, jugadores, misJugadores, onceReal] = await Promise.all([
    cargarHistorial(supabase, hincha.clubFavorito),
    cargarJugadores(supabase, hincha.clubFavorito),
    partido ? cargarMisJugadores(supabase, partido.id) : Promise.resolve(null),
    partido ? cargarOnceReal(supabase, partido.id) : Promise.resolve(null),
  ]);

  return (
    <main>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
      <h1>11 Elegido de {club}</h1>
      {partido ? (
        <section aria-label="Último Partido">
          <EncabezadoPartido club={club} partido={partido} />
          <VistaResultado club={hincha.clubFavorito} partido={partido} resultado={resultado} jugadores={jugadores} misJugadores={misJugadores} onceReal={onceReal} />
        </section>
      ) : (
        <p role="status">Todavía no cerró ninguna Votación de {club}.</p>
      )}
      <section aria-label="Historial">
        <h2>Historial</h2>
        <Historial club={club} items={historial} actual={partido?.id} />
      </section>
    </main>
  );
}
