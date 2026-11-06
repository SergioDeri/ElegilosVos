// Un Puesto sin Jugador: la silueta de una Camiseta en el césped con la sigla
// del Puesto debajo. Sin hooks: sirve en Server y Client Components.
import { rotulo, siluetaDePuestoLibre } from "@/domain/cancha";
import { Sprite } from "@/app/_pixel/sprite";
import estilos from "@/app/_pixel/pixel.module.css";

const silueta = siluetaDePuestoLibre();

export function PuestoLibre({ texto, ancho }: { texto: string; ancho: number }) {
  return (
    <span className={estilos.jugador}>
      <Sprite matriz={silueta} />
      <Sprite matriz={rotulo(texto, ancho)} className={estilos.rotulo} />
    </span>
  );
}
