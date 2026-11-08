"use client";

// Fondo de las pantallas de acceso: la cancha pixel (el mismo césped del
// armado) llenando la ventana, en píxeles de arte enteros (ADR 0004). Hasta
// medir no dibuja nada y se ve el --color-fondo.
import { memo, useLayoutEffect, useMemo, useState } from "react";
import { canchaDeFondo } from "@/domain/cancha";
import { pxPara } from "@/domain/pixel";
import { Sprite } from "@/app/_pixel/sprite";
import estilos from "./fondo-cancha.module.css";

const Cesped = memo(Sprite);

interface Medida {
  ancho: number;
  alto: number;
}

function medirVentana(): Medida {
  const ancho = document.documentElement.clientWidth;
  const alto = window.innerHeight;
  const valor = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--px"), 10);
  const px = Number.isInteger(valor) && valor > 0 ? valor : pxPara(ancho, alto);
  // Un píxel de arte de más en cada eje: el sobrante queda fuera de la ventana, sin huecos.
  return { ancho: Math.ceil(ancho / px), alto: Math.ceil(alto / px) };
}

export function FondoCancha() {
  const [medida, setMedida] = useState<Medida | null>(null);

  useLayoutEffect(() => {
    const medir = () => {
      const nueva = medirVentana();
      setMedida((vieja) => (vieja && vieja.ancho === nueva.ancho && vieja.alto === nueva.alto ? vieja : nueva));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const dibujo = useMemo(() => (medida ? canchaDeFondo(medida.ancho, medida.alto) : null), [medida]);

  return <div className={estilos.fondo}>{dibujo && <Cesped matriz={dibujo} />}</div>;
}
