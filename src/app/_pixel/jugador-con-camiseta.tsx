// Un Jugador como se ve en la cancha y en el banco: la Camiseta de su Club
// (la de arquero si su posición natural es ARQ) con el número en el pecho, y
// el apellido debajo, acortado para que entre en `ancho` píxeles de arte. Es
// solo dibujo: el nombre accesible lo pone quien lo usa.
import type { ClubId, PosicionNatural } from "@/domain/comun/tipos";
import { rotulo } from "@/domain/cancha";
import { camiseta } from "@/domain/pixel";
import { Sprite } from "./sprite";
import estilos from "./pixel.module.css";
import efectos from "./efectos.module.css";

export interface JugadorDibujable {
  nombre: string;
  /** null: sin número (Jugador desconocido). */
  numero: number | null;
  posicionNatural: PosicionNatural;
}

export function JugadorConCamiseta(props: {
  club: ClubId;
  jugador: JugadorDibujable;
  /** Ancho de la caja en píxeles de arte (par, al menos 24). */
  ancho: number;
  /** En la cancha: balanceo de 2 fotogramas, en fase 0 o 1 (desfasada). */
  balanceo?: 0 | 1;
  className?: string;
}) {
  const { club, jugador, ancho, balanceo, className } = props;
  const claseBalanceo = balanceo === undefined ? undefined : balanceo === 0 ? efectos.balanceo : efectos.balanceoDesfasado;
  return (
    <span className={className ? `${estilos.jugador} ${className}` : estilos.jugador}>
      <Sprite matriz={camiseta(club, jugador.posicionNatural, { numero: jugador.numero ?? undefined })} className={claseBalanceo} />
      <Sprite matriz={rotulo(jugador.nombre, ancho)} className={estilos.rotulo} />
    </span>
  );
}
