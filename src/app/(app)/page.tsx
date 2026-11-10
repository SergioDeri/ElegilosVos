// Inicio del Hincha: lo primero que ve al entrar es el 11 que va ganando en la
// Votación abierta de su Club (el Parcial, ticket 11), después el acceso a su
// propia Alineación (/mi-alineacion) y la tarjeta del próximo Partido.
import Link from "next/link";
import { requerirHincha } from "@/lib/auth/sesion";
import { asegurarHerencia } from "@/lib/herencia/asegurar";
import { obtenerParcial, SEGUNDOS_DE_CACHE_DEL_PARCIAL } from "@/lib/parcial";
import { VistaParcial } from "@/app/_parcial/vista-parcial";
import { cargarPartidoEnPantalla } from "./_partido/pantalla";
import { TarjetaPartido } from "./_partido/tarjeta-partido";
import { EnlaceParcial } from "./parcial/enlace-parcial";

export default async function Inicio() {
  const hincha = await requerirHincha();
  const pantalla = await cargarPartidoEnPantalla(hincha);
  const { club, votacion, partido } = pantalla;

  if (!votacion || !partido) {
    return (
      <main>
        <h1>Elegilos Vos</h1>
        <Link href="/resultados">Ver el 11 Elegido y el historial</Link>
        <p>Sos hincha de {club}.</p>
        <p role="status">Todavía no hay un próximo Partido de {club} cargado. Cuando se cargue, vas a poder armar tu 11.</p>
      </main>
    );
  }

  const abierta = votacion.estado === "abierta";
  // La Alineación heredada tiene que contar en el Parcial aunque el Hincha
  // todavía no haya entrado al armado.
  if (abierta) await asegurarHerencia(hincha.id, hincha.clubFavorito, pantalla.ahora);
  const parcial = abierta ? await obtenerParcial(partido.id) : null;

  return (
    <main>
      <h1>Elegilos Vos</h1>
      <Link href="/resultados">Ver el 11 Elegido y el historial</Link>

      {parcial?.tipo === "ok" && (
        <section aria-label="El 11 que va ganando">
          <h2>
            El 11 de la hinchada vs {partido.rival?.nombre ?? "Rival a confirmar"}
          </h2>
          <VistaParcial
            resultado={parcial.resultado}
            jugadores={pantalla.jugadores}
            textoVacio="Todavía no hay votos. ¡Armá tu Alineación y sé el primero!"
            club={hincha.clubFavorito}
            soloElOnce
          />
          <p>Resultado provisorio: puede tener hasta {SEGUNDOS_DE_CACHE_DEL_PARCIAL} segundos de demora.</p>
        </section>
      )}

      {votacion.estado !== "anulada" && (
        <p>
          <Link href="/mi-alineacion" className="boton">
            Ver mi alineación
          </Link>
        </p>
      )}
      {parcial?.tipo === "ok" && <EnlaceParcial />}

      <TarjetaPartido pantalla={pantalla} partido={partido} votacion={votacion} />
    </main>
  );
}
