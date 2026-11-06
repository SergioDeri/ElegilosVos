// Cancha compartida por el armado de la Alineación, el Parcial y los
// resultados: dibuja el campo y ubica cada Puesto según su (x, y) del Esquema.
// El contenido de cada Puesto (y si es un botón arrastrable o un rótulo) lo
// decide cada vista. Sin hooks: sirve en Server y Client Components.
import type { CSSProperties, HTMLAttributes } from "react";
import estilos from "./cancha.module.css";

/** Clases base del Puesto y de su sigla; cada vista suma las suyas. */
export const CLASE_PUESTO = estilos.puesto;
export const CLASE_SIGLA = estilos.sigla;

/** Ubicación del Puesto en la cancha: `x` (0 izquierda .. 1 derecha), `y` (0 arco propio .. 1 arco rival). */
export function posicionPuesto(p: { x: number; y: number }): CSSProperties {
  return { left: `${p.x * 100}%`, bottom: `${p.y * 100}%` };
}

export function Cancha({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className ? `${estilos.cancha} ${className}` : estilos.cancha} {...props} />;
}
