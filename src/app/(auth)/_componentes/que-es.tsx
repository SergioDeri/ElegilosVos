"use client";

// "¿Qué es Elegilos Vos?" y "Donar con PayPal" en el login, uno al lado del
// otro a la izquierda. El texto se despliega debajo de los dos (con <details>
// quedaría dentro del desplegable y empujaría el link de PayPal).
import { useId, useState } from "react";
import { Icono } from "@/app/_pixel/icono";
import estilos from "./que-es.module.css";

const DONAR_PAYPAL = "https://www.paypal.com/donate/?hosted_button_id=U3EP35SY7MMCN";

export function QueEs() {
  const [abierto, setAbierto] = useState(false);
  const idTexto = useId();

  return (
    <div className={estilos.queEs}>
      <div className={estilos.fila}>
        <button
          type="button"
          className={estilos.link}
          aria-expanded={abierto}
          aria-controls={idTexto}
          onClick={() => setAbierto((a) => !a)}
        >
          <Icono nombre="info" />
          ¿Qué es Elegilos Vos?
        </button>
        <a className={estilos.link} href={DONAR_PAYPAL} target="_blank" rel="noopener noreferrer">
          Donar con PayPal
        </a>
      </div>
      <div id={idTexto} hidden={!abierto}>
        <p>
          Antes de cada partido, los hinchas de Peñarol y Nacional arman el 11 titular de su club, y cualquier hincha
          arma el de la Selección. Al cierre de la votación juntamos las alineaciones de todos y sale el 11 elegido por
          la hinchada.
        </p>
        <p>
          La idea es darle voz al hincha más allá de las decisiones del director técnico: que se vea qué jugadores la
          hinchada pide que jueguen más y cuáles deberían jugar menos.
        </p>
      </div>
    </div>
  );
}
