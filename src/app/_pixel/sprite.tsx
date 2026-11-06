// Dibuja una matriz de @/domain/pixel como SVG, 1 celda = 1 píxel de arte
// (--u), sin suavizado (ADR 0004). Sin hooks: sirve en Server y Client
// Components.
import type { CSSProperties, ReactElement } from "react";
import type { Matriz } from "@/domain/pixel";

export function Sprite({ matriz, className, style }: { matriz: Matriz; className?: string; style?: CSSProperties }) {
  const alto = matriz.length;
  const ancho = matriz[0]?.length ?? 0;
  // Un <rect> por tramo horizontal del mismo color.
  const rects: ReactElement[] = [];
  matriz.forEach((fila, y) => {
    let x = 0;
    while (x < ancho) {
      const color = fila[x];
      let fin = x + 1;
      while (fin < ancho && fila[fin] === color) fin++;
      if (color) rects.push(<rect key={`${x},${y}`} x={x} y={y} width={fin - x} height={1} fill={color} />);
      x = fin;
    }
  });
  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
      className={className}
      style={{ display: "block", width: `calc(${ancho} * var(--u))`, height: `calc(${alto} * var(--u))`, ...style }}
    >
      {rects}
    </svg>
  );
}
