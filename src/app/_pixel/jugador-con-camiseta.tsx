// Un Jugador como se ve en la cancha y en el banco: la Camiseta de su Club o
// de la Selección (la de arquero si su posición natural es ARQ) con el número
// en el pecho (la de la Selección no lleva) y el nombre debajo, en una o dos
// líneas de `ancho` píxeles de arte: en un Club el apellido; en la Selección
// el nombre completo. Si no entra se acorta (apellido, guion entre sílabas):
// nunca sale de la caja ni pisa al de al lado. Es solo dibujo: el nombre accesible lo pone quien lo usa.
import { SELECCION, type ClubOSeleccion, type PosicionNatural } from "@/domain/comun/tipos";
import { rotuloCompleto, rotuloDeClub } from "@/domain/cancha";
import { camiseta } from "@/domain/pixel";
import { Sprite } from "./sprite";
import estilos from "./pixel.module.css";

export interface JugadorDibujable {
  nombre: string;
  /** null: sin número (Jugador desconocido o de la Selección). */
  numero: number | null;
  posicionNatural: PosicionNatural;
}

export function JugadorConCamiseta(props: {
  club: ClubOSeleccion;
  jugador: JugadorDibujable;
  /** Ancho de la caja en píxeles de arte (par, al menos 24). */
  ancho: number;
  className?: string;
}) {
  const { club, jugador, ancho, className } = props;
  const nombre = club === SELECCION ? rotuloCompleto(jugador.nombre, ancho) : rotuloDeClub(jugador.nombre, ancho);
  return (
    <span className={className ? `${estilos.jugador} ${className}` : estilos.jugador}>
      <Sprite matriz={camiseta(club, jugador.posicionNatural, { numero: jugador.numero ?? undefined })} />
      <Sprite matriz={nombre} className={estilos.rotulo} />
    </span>
  );
}
