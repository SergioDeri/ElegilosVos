// Parcial en vivo para el Hincha (ticket 11): el resultado provisorio de la
// Votación abierta de su Club. Se calcula en el servidor (service role, solo
// agregados, con caché corta) a través de `obtenerParcial`.
import Link from "next/link";
import { notFound } from "next/navigation";
import { votacionEnPantalla } from "@/domain/armado";
import { requerirHincha } from "@/lib/auth/sesion";
import { obtenerParcial, SEGUNDOS_DE_CACHE_DEL_PARCIAL } from "@/lib/parcial";
import { crearClienteServidor } from "@/lib/supabase/server";
import { leerPartidos, leerPlantel } from "@/lib/club/lecturas";
import { VistaParcial } from "../../_parcial/vista-parcial";
import { NOMBRE_CLUB } from "@/domain/comun/textos";

function horaActual(): Date {
  return new Date();
}

export default async function PaginaParcial() {
  const hincha = await requerirHincha();
  const club = NOMBRE_CLUB[hincha.clubFavorito];
  const supabase = await crearClienteServidor();
  const [partidos, jugadores] = await Promise.all([
    leerPartidos(supabase, hincha.clubFavorito),
    leerPlantel(supabase, hincha.clubFavorito),
  ]);
  const votacion = votacionEnPantalla(partidos, horaActual());
  const partido = votacion?.estado === "abierta" ? partidos.find((p) => p.id === votacion.partidoId) : undefined;
  const parcial = partido ? await obtenerParcial(partido.id) : null;
  if (parcial?.tipo === "prohibido") notFound();

  return (
    <main>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
      <h1>Parcial de {club}</h1>
      {!partido || !parcial || parcial.tipo === "no_abierta" ? (
        <p role="status">No hay una Votación abierta: el Parcial se ve mientras la Votación está abierta.</p>
      ) : (
        <>
          <p>
            {club} vs {partido.rival?.nombre ?? "Rival a confirmar"}. Resultado provisorio (puede tener hasta{" "}
            {SEGUNDOS_DE_CACHE_DEL_PARCIAL} segundos de demora).
          </p>
          <VistaParcial
            resultado={parcial.resultado}
            jugadores={jugadores}
            textoVacio="Todavía no hay votos. ¡Armá tu Alineación y sé el primero!"
            club={hincha.clubFavorito}
          />
        </>
      )}
    </main>
  );
}
