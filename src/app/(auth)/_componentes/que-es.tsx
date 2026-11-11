"use client";

// "¿Qué es Elegilos Vos?" en el login: abre un pop-up (<dialog> modal nativo:
// tapa la página, cierra con "Cerrar", con Escape o tocando afuera).
import { useRef } from "react";
import { Icono } from "@/app/_pixel/icono";
import estilos from "./que-es.module.css";

export function QueEs() {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <div>
      <button type="button" className={estilos.link} onClick={() => dialogo.current?.showModal()}>
        <Icono nombre="info" />
        ¿Qué es Elegilos Vos?
      </button>
      <dialog
        ref={dialogo}
        className={estilos.dialogo}
        aria-labelledby="que-es-titulo"
        // Tocar el fondo oscuro (fuera de la caja) también cierra.
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      >
        <h2 id="que-es-titulo">¿Qué es Elegilos Vos?</h2>
        <p>
          Antes de cada partido, los hinchas de Peñarol y Nacional arman el 11 titular de su club, y cualquier hincha
          arma el de la Selección. Al cierre de la votación juntamos las alineaciones de todos y sale el 11 elegido por
          la hinchada.
        </p>
        <p>
          La idea es darle voz al hincha más allá de las decisiones del director técnico: que se vea qué jugadores la
          hinchada pide que jueguen más y cuáles deberían jugar menos.
        </p>
        <form method="dialog">
          <button type="submit" autoFocus>
            Cerrar
          </button>
        </form>
      </dialog>
    </div>
  );
}
