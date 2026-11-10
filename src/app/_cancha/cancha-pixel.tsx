"use client";

// Cancha pixel compartida (ticket 03): ocupa todo el espacio de su contenedor,
// lo mide con un observador de tamaño y le pide la disposición a
// @/domain/cancha (orientación, cancha, Puestos y banco, en píxeles de arte).
// El contenido de cada Puesto y del banco lo decide cada vista.
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { TITULO_BANCO, disponer, type Banco, type Orientacion, type PuestoEnCancha, type Rect } from "@/domain/cancha";
import type { EsquemaId } from "@/domain/esquemas";
import { icono, pxPara, textoBitmap, type Matriz } from "@/domain/pixel";
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

const ICONOS_FLECHA = {
  horizontal: { antes: icono("flechaIzquierda", "cal"), despues: icono("flechaDerecha", "cal") },
  vertical: { antes: icono("flechaArriba", "cal"), despues: icono("flechaAbajo", "cal") },
};

/** Hasta dónde se puede scrollear la ventana hacia cada lado. */
interface Topes {
  antes: boolean;
  despues: boolean;
}

/**
 * El título "SUPLENTES" y la grilla del banco que calculó la disposición.
 * Si los suplentes no entran, la grilla se scrollea dentro de su ventana
 * (con rueda, gesto o foco) y las flechas la mueven de a una ventana.
 */
export function BancoPixel({ banco, children }: { banco: Banco; children: ReactNode }) {
  const u = (n: number) => `calc(${n} * var(--u))`;
  const ventana = useRef<HTMLDivElement>(null);
  const [topes, setTopes] = useState<Topes>({ antes: true, despues: false });
  const { desplazamiento, flechas } = banco;

  const medirTopes = useCallback(() => {
    const v = ventana.current;
    if (!v || !desplazamiento) return;
    const [pos, max] =
      desplazamiento === "horizontal" ? [v.scrollLeft, v.scrollWidth - v.clientWidth] : [v.scrollTop, v.scrollHeight - v.clientHeight];
    // Medio píxel de tolerancia: el zoom del navegador deja posiciones fraccionarias.
    const nuevos = { antes: pos <= 0.5, despues: pos >= max - 0.5 };
    setTopes((viejos) => (viejos.antes === nuevos.antes && viejos.despues === nuevos.despues ? viejos : nuevos));
  }, [desplazamiento]);

  // Al cambiar la grilla (otra ventana, más o menos suplentes) los topes cambian.
  useLayoutEffect(medirTopes, [medirTopes, banco]);

  const mover = (sentido: -1 | 1) => {
    const v = ventana.current;
    if (!v) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paso = sentido * (desplazamiento === "horizontal" ? v.clientWidth : v.clientHeight);
    v.scrollBy({
      [desplazamiento === "horizontal" ? "left" : "top"]: paso,
      behavior: suave ? "smooth" : "instant",
    });
  };

  return (
    <div className={estilos.bancoPixel}>
      <Sprite matriz={titulo} />
      {flechas && desplazamiento && (
        <>
          <Flecha rect={flechas.antes} matriz={ICONOS_FLECHA[desplazamiento].antes} tope={topes.antes} alTocar={() => mover(-1)} />
          <Flecha rect={flechas.despues} matriz={ICONOS_FLECHA[desplazamiento].despues} tope={topes.despues} alTocar={() => mover(1)} />
        </>
      )}
      <div
        ref={ventana}
        className={estilos.ventana}
        data-desplazamiento={desplazamiento ?? undefined}
        style={estiloDeRect(banco.ventana)}
        onScroll={desplazamiento ? medirTopes : undefined}
      >
        <ul
          className={estilos.grilla}
          style={{
            gap: u(banco.separacion),
            gridTemplateColumns: `repeat(${banco.columnas}, ${u(banco.anchoItem)})`,
            gridTemplateRows: `repeat(${banco.filas}, ${u(banco.altoItem)})`,
            gridAutoFlow: banco.flujo,
          }}
        >
          {children}
        </ul>
      </div>
    </div>
  );
}

/**
 * Flecha de scroll del banco. Es una ayuda para el puntero: con teclado, el
 * foco ya lleva la ventana hasta cada suplente, así que no entra en el orden
 * de tabulación.
 */
function Flecha({ rect, matriz, tope, alTocar }: { rect: Rect; matriz: Matriz; tope: boolean; alTocar: () => void }) {
  return (
    <button type="button" tabIndex={-1} aria-hidden className={estilos.flecha} style={estiloDeRect(rect)} disabled={tope} onClick={alTocar}>
      <Sprite matriz={matriz} />
    </button>
  );
}
