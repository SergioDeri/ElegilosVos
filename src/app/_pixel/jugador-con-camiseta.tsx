// Un Jugador como se ve en la cancha y en el banco: la Camiseta de su Club
// (la de arquero si su posición natural es ARQ) con el número en el pecho, y
// el apellido debajo. Es solo dibujo: el nombre accesible lo pone quien lo usa.
import type { ClubId, PosicionNatural } from "@/domain/comun/tipos";
import { camiseta, textoBitmap } from "@/domain/pixel";
import { nombreCorto } from "@/domain/planteles";
import { Sprite } from "./sprite";
import estilos from "./pixel.module.css";

export interface JugadorDibujable {
  nombre: string;
  numero: number;
  posicionNatural: PosicionNatural;
}

export function JugadorConCamiseta({ club, jugador, className }: { club: ClubId; jugador: JugadorDibujable; className?: string }) {
  return (
    <span className={className ? `${estilos.jugador} ${className}` : estilos.jugador}>
      <Sprite matriz={camiseta(club, jugador.posicionNatural, { numero: jugador.numero })} />
      <Sprite matriz={textoBitmap(nombreCorto(jugador.nombre), "cal", { contorno: true })} />
    </span>
  );
}
