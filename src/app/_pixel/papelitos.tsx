// Papelitos pixelados que caen una vez sobre la pantalla (11 Elegido y
// Coincidencia). Solo decoración: aria-hidden, sin eventos, y con "reducir
// movimiento" no se muestran. Posiciones fijas (deterministas), sin hooks.
import type { CSSProperties } from "react";
import estilos from "./efectos.module.css";

const CANTIDAD = 36;

/** Columna (en % del ancho), demora y deriva lateral de cada papelito. */
const PAPELITOS = Array.from({ length: CANTIDAD }, (_, i) => ({
  izquierda: (i * 37) % 100,
  demora: ((i * 7) % 12) * 60,
  deriva: ((i * 5) % 9) - 4,
}));

export function Papelitos() {
  return (
    <div className={estilos.papelitos} aria-hidden>
      {PAPELITOS.map((p, i) => (
        <span
          key={i}
          className={estilos.papelito}
          style={
            {
              left: `round(down, ${p.izquierda}%, var(--u))`,
              animationDelay: `${p.demora}ms`,
              "--dx": p.deriva * 4,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
