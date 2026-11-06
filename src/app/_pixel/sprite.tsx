// Dibuja una matriz de @/domain/pixel como SVG, 1 celda = 1 píxel de arte
// (--u), sin suavizado (ADR 0004). Sin hooks: sirve en Server y Client
// Components.
import type { CSSProperties } from "react";
import type { Matriz } from "@/domain/pixel";

interface Tramo {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  color: string;
}

/**
 * Tramos horizontales del mismo color, unidos con el de la fila de arriba
 * cuando coinciden: las franjas de la cancha quedan en pocos rectángulos.
 */
function tramos(matriz: Matriz): Tramo[] {
  const todos: Tramo[] = [];
  let abiertos = new Map<string, Tramo>();
  matriz.forEach((fila, y) => {
    const siguientes = new Map<string, Tramo>();
    let x = 0;
    while (x < fila.length) {
      const color = fila[x];
      let fin = x + 1;
      while (fin < fila.length && fila[fin] === color) fin++;
      if (color) {
        const clave = `${x},${fin},${color}`;
        const arriba = abiertos.get(clave);
        if (arriba) {
          arriba.alto++;
          siguientes.set(clave, arriba);
        } else {
          const t = { x, y, ancho: fin - x, alto: 1, color };
          todos.push(t);
          siguientes.set(clave, t);
        }
      }
      x = fin;
    }
    abiertos = siguientes;
  });
  return todos;
}

export function Sprite({ matriz, className, style }: { matriz: Matriz; className?: string; style?: CSSProperties }) {
  const alto = matriz.length;
  const ancho = matriz[0]?.length ?? 0;
  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
      className={className}
      style={{ display: "block", width: `calc(${ancho} * var(--u))`, height: `calc(${alto} * var(--u))`, ...style }}
    >
      {tramos(matriz).map((t) => (
        <rect key={`${t.x},${t.y}`} x={t.x} y={t.y} width={t.ancho} height={t.alto} fill={t.color} />
      ))}
    </svg>
  );
}
