// Parcial de la Selección (Selección, ticket 08): el 11 que va ganando, los
// porcentajes por Esquema y por Puesto y el Más Pedido (o, con Convocatoria,
// el Gran Ausente provisorio: ticket 09), con los votos de
// todos los Hinchas (un solo resultado, sin separar por hinchada). En una
// fecha doble hay uno por Partido: se elige con `?partido=<id>`, como en el
// armado. Se calcula en el servidor (service role, solo agregados, caché
// corta) a través de `obtenerParcialDeLaSeleccion`.
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatearHoraUy } from "@/domain/comun/horario";
import { SELECCION } from "@/domain/comun/tipos";
import { requerirHinchada } from "@/lib/auth/sesion";
import { RUTA_SELECCION } from "@/lib/auth/rutas";
import { obtenerParcialDeLaSeleccion, SEGUNDOS_DE_CACHE_DEL_PARCIAL } from "@/lib/parcial";
import { VistaDestacado, VistaParcial } from "../../../_parcial/vista-parcial";
import { cargarPantallaDeLaSeleccion } from "../../_partido/pantalla";

export default async function PaginaParcialDeLaSeleccion({ searchParams }: PageProps<"/seleccion/parcial">) {
  await requerirHinchada();
  const { partido: elegido } = await searchParams;
  const pantalla = await cargarPantallaDeLaSeleccion();
  const abiertas = pantalla.opciones.filter((o) => o.votacion.estado === "abierta");
  const partido = (abiertas.find((o) => o.partido.id === elegido) ?? abiertas[0])?.partido;
  const parcial = partido ? await obtenerParcialDeLaSeleccion(partido.id) : null;
  if (parcial?.tipo === "prohibido") notFound();

  return (
    <main>
      <p>
        <Link href={partido ? `${RUTA_SELECCION}?partido=${partido.id}` : RUTA_SELECCION}>Volver a la Selección</Link>
      </p>
      <h1>Parcial de la Selección</h1>
      {abiertas.length > 1 && (
        <nav aria-label="Elegí el Partido">
          <p>Hay {abiertas.length} Votaciones abiertas. Elegí de qué Partido ver el Parcial:</p>
          <ul>
            {abiertas.map((o) => (
              <li key={o.partido.id}>
                <Link
                  href={`${RUTA_SELECCION}/parcial?partido=${o.partido.id}`}
                  aria-current={o.partido.id === partido?.id ? "page" : undefined}
                >
                  vs {o.partido.rival?.nombre ?? "Rival a confirmar"} ({formatearHoraUy(o.partido.inicio)})
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {!partido || !parcial || parcial.tipo === "no_abierta" ? (
        <p role="status">No hay una Votación abierta: el Parcial se ve mientras la Votación está abierta.</p>
      ) : (
        <>
          <p>
            Selección vs {partido.rival?.nombre ?? "Rival a confirmar"}. Resultado provisorio con los votos de todos los
            Hinchas (puede tener hasta {SEGUNDOS_DE_CACHE_DEL_PARCIAL} segundos de demora).
          </p>
          <VistaDestacado destacado={parcial.resultado.destacado} jugadores={pantalla.jugadores} />
          <VistaParcial
            resultado={parcial.resultado.resultado}
            jugadores={pantalla.jugadores}
            textoVacio="Todavía no hay votos. ¡Armá tu Alineación y sé el primero!"
            club={SELECCION}
          />
        </>
      )}
    </main>
  );
}
