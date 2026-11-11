// Inicio de la Selección, como el del Club: lo primero que se ve es el 11 que
// va ganando en la Votación abierta (el Parcial, ticket 08) y el destacado
// (el Más Pedido o, con Convocatoria, el Gran Ausente provisorio: ticket 09);
// después el botón "Ver mi alineación" al armado
// (/seleccion/mi-alineacion) y la tarjeta del Partido. La Votación abre 14
// días antes de cada Partido, así que en una fecha doble hay dos abiertas a
// la vez: el Hincha elige el Partido (`?partido=<id>`).
//
// Los resultados (11 Elegido y Gran Ausente final, ticket 10) están en
// /seleccion/resultados.
import Link from "next/link";
import { formatearHoraUy } from "@/domain/comun/horario";
import { SELECCION } from "@/domain/comun/tipos";
import { requerirHinchada } from "@/lib/auth/sesion";
import { RUTA_SELECCION } from "@/lib/auth/rutas";
import { asegurarHerencia } from "@/lib/herencia/asegurar";
import { obtenerParcialDeLaSeleccion, SEGUNDOS_DE_CACHE_DEL_PARCIAL } from "@/lib/parcial";
import { VistaDestacado, VistaParcial } from "@/app/_parcial/vista-parcial";
import { EnlaceParcial } from "../parcial/enlace-parcial";
import { cargarPantallaDeLaSeleccion } from "../_partido/pantalla";
import { TarjetaPartido } from "../_partido/tarjeta-partido";

export default async function Seleccion({ searchParams }: PageProps<"/seleccion">) {
  const hincha = await requerirHinchada();
  const { partido: elegido } = await searchParams;
  const pantalla = await cargarPantallaDeLaSeleccion(typeof elegido === "string" ? elegido : undefined);
  const { votacion, partido, jugadores, opciones } = pantalla;

  if (!votacion || !partido) {
    return (
      <main>
        <h1>Selección</h1>
        <Link href={`${RUTA_SELECCION}/resultados`}>Ver el 11 Elegido y el historial</Link>
        <p role="status">
          Todavía no hay un próximo Partido de la Selección cargado. Cuando se cargue, vas a poder armar tu 11.
        </p>
      </main>
    );
  }

  const abierta = votacion.estado === "abierta";
  // Herencia (ticket 07): al entrar se materializa la de cada Votación
  // abierta (no depender solo del cron), en paralelo con el Parcial.
  const [, parcial] = abierta
    ? await Promise.all([asegurarHerencia(hincha.id, SELECCION, pantalla.ahora), obtenerParcialDeLaSeleccion(partido.id)])
    : [undefined, null];
  const rival = partido.rival?.nombre ?? "Rival a confirmar";

  return (
    <main>
      <h1>Selección</h1>
      <Link href={`${RUTA_SELECCION}/resultados`}>Ver el 11 Elegido y el historial</Link>
      {opciones.length > 1 && (
        <nav aria-label="Elegí el Partido">
          <p>Hay {opciones.length} Votaciones abiertas. Elegí el Partido:</p>
          <ul>
            {opciones.map((o) => (
              <li key={o.partido.id}>
                <Link
                  href={`${RUTA_SELECCION}?partido=${o.partido.id}`}
                  aria-current={o.partido.id === partido.id ? "page" : undefined}
                >
                  vs {o.partido.rival?.nombre ?? "Rival a confirmar"} ({formatearHoraUy(o.partido.inicio)})
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {parcial?.tipo === "ok" && (
        <section aria-label="El 11 que va ganando">
          <h2>El 11 de la hinchada vs {rival}</h2>
          <VistaDestacado destacado={parcial.resultado.destacado} jugadores={jugadores} />
          <VistaParcial
            resultado={parcial.resultado.resultado}
            jugadores={jugadores}
            textoVacio="Todavía no hay votos. ¡Armá tu Alineación y sé el primero!"
            club={SELECCION}
            soloElOnce
          />
          <p>Resultado provisorio: puede tener hasta {SEGUNDOS_DE_CACHE_DEL_PARCIAL} segundos de demora.</p>
        </section>
      )}

      {votacion.estado !== "anulada" && (
        <p>
          <Link href={`${RUTA_SELECCION}/mi-alineacion?partido=${partido.id}`} className="boton">
            Ver mi alineación
          </Link>
        </p>
      )}
      {parcial?.tipo === "ok" && <EnlaceParcial href={`${RUTA_SELECCION}/parcial?partido=${partido.id}`} />}

      <TarjetaPartido pantalla={pantalla} partido={partido} votacion={votacion} />
    </main>
  );
}
