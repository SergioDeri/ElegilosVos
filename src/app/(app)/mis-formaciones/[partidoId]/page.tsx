// Una formación del histórico del Hincha: su Alineación de ese Partido en la
// cancha, con el enlace al 11 Elegido.
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatearHoraUy } from "@/domain/comun/horario";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { esquema } from "@/domain/esquemas";
import { requerirHincha } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CanchaDeLectura } from "@/app/_cancha/cancha-de-lectura";
import { cargarAlineacion } from "../../_alineacion/datos";
import { cargarJugadores, cargarPartido } from "../../resultados/_resultados/datos";

export default async function PaginaMiFormacion({ params }: PageProps<"/mis-formaciones/[partidoId]">) {
  const { partidoId } = await params;
  const hincha = await requerirHincha();
  const club = NOMBRE_CLUB[hincha.clubFavorito];
  const supabase = await crearClienteServidor();

  // RLS: solo Partidos de su Club y solo su propia Alineación.
  const partido = await cargarPartido(supabase, hincha.clubFavorito, partidoId);
  if (!partido) notFound();
  const [alineacion, jugadores] = await Promise.all([
    cargarAlineacion(supabase, partido.id),
    cargarJugadores(supabase, hincha.clubFavorito),
  ]);
  if (!alineacion) notFound();

  return (
    <main>
      <p>
        <Link href="/mis-formaciones">Volver a mis formaciones</Link>
      </p>
      <h1>Mi formación</h1>
      <h2>
        {club} vs {partido.rival}
      </h2>
      <p>
        <time dateTime={partido.inicio.toISOString()}>{formatearHoraUy(partido.inicio)}</time> · Esquema{" "}
        {alineacion.esquema}
      </p>
      <CanchaDeLectura
        club={hincha.clubFavorito}
        esquema={alineacion.esquema}
        aria-label={`Mi formación en ${alineacion.esquema}`}
        puestos={Object.fromEntries(
          esquema(alineacion.esquema).puestos.map((p) => {
            const id = alineacion.puestos[p.id]?.jugadorId;
            const jugador = id ? (jugadores.get(id) ?? null) : null;
            return [
              p.id,
              {
                jugador,
                descripcion: `${p.etiqueta}: ${jugador ? `${jugador.numero}. ${jugador.nombre}` : "vacante"}`,
              },
            ];
          }),
        )}
      />
      <p>
        <Link href={`/resultados/${partido.id}`}>Ver el 11 Elegido de este Partido</Link>
      </p>
    </main>
  );
}
