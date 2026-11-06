"use client";

// Cancha pixel compartida (ticket 03): ocupa todo el espacio de su contenedor,
// lo mide con un observador de tamaño y le pide la disposición a
// @/domain/cancha (orientación, cancha, Puestos y banco, en píxeles de arte).
// El contenido de cada Puesto y del banco lo decide cada vista.
import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { TITULO_BANCO, disponer, type Banco, type Orientacion, type PuestoEnCancha, type Rect } from "@/domain/cancha";
import type { EsquemaId } from "@/domain/esquemas";
import { pxPara, textoBitmap } from "@/domain/pixel";
import { Sprite } from "@/app/_pixel/sprite";
import estilos from "./cancha-pixel.module.css";

const Cesped = memo(Sprite);

/** Posición y tamaño de un rectángulo de píxeles de arte, en múltiplos de --u. */
export function estiloDeRect(r: Rect): CSSProperties {
  return {
    left: `calc(${r.x} * var(--u))`,
    top: `calc(${r.y} * var(--u))`,
    width: `calc(${r.ancho} * var(--u))`,
    height: `calc(${r.alto} * var(--u))`,
  };
}

interface Medida {
  ancho: number;
  alto: number;
  px: number;
}

function pxDelDocumento(): number {
  const valor = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--px"), 10);
  return Number.isInteger(valor) && valor > 0 ? valor : pxPara(window.innerWidth, window.innerHeight);
}

export interface PropsCanchaPixel {
  esquema: EsquemaId;
  /** Cantidad de suplentes (0: sin banco). */
  suplentes?: number;
  /** Contenido de cada Puesto: ocupa su caja entera. */
  puesto: (p: PuestoEnCancha) => ReactNode;
  /** Contenido del banco: ocupa su rectángulo entero (ver BancoPixel). */
  banco?: (b: Banco, orientacion: Orientacion) => ReactNode;
  role?: string;
  "aria-label"?: string;
  className?: string;
}

export function CanchaPixel({ esquema, suplentes = 0, puesto, banco, className, ...aria }: PropsCanchaPixel) {
  const ref = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState<Medida | null>(null);

  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    const medir = () => {
      const { width, height } = nodo.getBoundingClientRect();
      const nueva = { ancho: width, alto: height, px: pxDelDocumento() };
      setMedida((vieja) =>
        vieja && vieja.ancho === nueva.ancho && vieja.alto === nueva.alto && vieja.px === nueva.px ? vieja : nueva,
      );
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const disposicion = useMemo(
    () => (medida && medida.ancho > 0 && medida.alto > 0 ? disponer({ ...medida, esquema, suplentes }) : null),
    [medida, esquema, suplentes],
  );

  return (
    <div ref={ref} className={className ? `${estilos.area} ${className}` : estilos.area}>
      {disposicion && (
        <>
          <div className={estilos.cancha} style={estiloDeRect(disposicion.cancha)} {...aria}>
            <Cesped matriz={disposicion.dibujo} />
            {disposicion.puestos.map((p) => (
              <div key={p.id} className={estilos.puesto} style={estiloDeRect(p)}>
                {puesto(p)}
              </div>
            ))}
          </div>
          {disposicion.banco && banco && (
            <div className={estilos.banco} style={estiloDeRect(disposicion.banco)}>
              {banco(disposicion.banco, disposicion.orientacion)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const titulo = textoBitmap(TITULO_BANCO, "gris");

/** El título "SUPLENTES" y la grilla del banco que calculó la disposición. */
export function BancoPixel({ banco, orientacion, children }: { banco: Banco; orientacion: Orientacion; children: ReactNode }) {
  const u = (n: number) => `calc(${n} * var(--u))`;
  return (
    <div className={estilos.bancoPixel}>
      <Sprite matriz={titulo} />
      <ul
        className={estilos.grilla}
        style={{
          top: u(banco.grilla.y),
          left: u(banco.grilla.x),
          gap: u(banco.separacion),
          gridTemplateColumns: `repeat(${banco.columnas}, ${u(banco.anchoItem)})`,
          gridTemplateRows: `repeat(${banco.filas}, ${u(banco.altoItem)})`,
          gridAutoFlow: orientacion === "vertical" ? "row" : "column",
        }}
      >
        {children}
      </ul>
    </div>
  );
}
