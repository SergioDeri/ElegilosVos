"use client";

// Menú del usuario en la barra de la app: un botón con el ícono de usuario que
// abre un panel con Mi cuenta, Mis formaciones y Cerrar sesión. Se cierra al
// elegir una opción, al tocar afuera o con Escape.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { BotonCerrarSesion } from "@/app/_sesion/boton-cerrar-sesion";
import { Icono } from "@/app/_pixel/icono";
import estilos from "./barra.module.css";

export function MenuUsuario() {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idPanel = useId();

  useEffect(() => {
    if (!abierto) return;
    function alTocar(evento: PointerEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    }
    function alApretar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    }
    document.addEventListener("pointerdown", alTocar);
    document.addEventListener("keydown", alApretar);
    return () => {
      document.removeEventListener("pointerdown", alTocar);
      document.removeEventListener("keydown", alApretar);
    };
  }, [abierto]);

  const cerrar = () => setAbierto(false);

  return (
    <div className={estilos.menu} ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className={estilos.botonUsuario}
        aria-label="Menú de usuario"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((a) => !a)}
      >
        <Icono nombre="usuario" />
      </button>
      <nav id={idPanel} className={estilos.panel} hidden={!abierto} aria-label="Menú de usuario">
        <ul>
          <li>
            <Link href="/cuenta" onClick={cerrar}>
              Mi cuenta
            </Link>
          </li>
          <li>
            <Link href="/mis-formaciones" onClick={cerrar}>
              Mis formaciones
            </Link>
          </li>
        </ul>
        <BotonCerrarSesion />
      </nav>
    </div>
  );
}
