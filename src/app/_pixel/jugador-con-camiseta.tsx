// Un Jugador como se ve en la cancha y en el banco: la Camiseta de su Club o
// de la Selección (la de arquero si su posición natural es ARQ) con el número
// en el pecho (la de la Selección no lleva) y el nombre debajo. En un Club va
// el apellido, acortado para que entre en `ancho` píxeles de arte; en la
// Selección, el nombre completo sin cortar (en dos líneas si hace falta; si
// aun así no entra, sobresale centrado de la caja). Es solo dibujo: el nombre
// accesible lo pone quien lo usa.
import { SELECCION, type ClubOSeleccion, type PosicionNatural } from "@/domain/comun/tipos";
import { rotulo, rotuloCompleto } from "@/domain/cancha";
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
  const nombre = club === SELECCION ? rotuloCompleto(jugador.nombre, ancho) : rotulo(jugador.nombre, ancho);
  // Lo que sobresale de la caja se reparte a los dos lados sin agrandarla.
  const sobra = (nombre[0]?.length ?? ancho) - ancho;
  return (
    <span className={className ? `${estilos.jugador} ${className}` : estilos.jugador}>
      <Sprite matriz={camiseta(club, jugador.posicionNatural, { numero: jugador.numero ?? undefined })} />
      <Sprite
        matriz={nombre}
        className={estilos.rotulo}
        style={sobra > 0 ? { marginInline: `calc(${-sobra / 2} * var(--u))` } : undefined}
      />
    </span>
  );
}
