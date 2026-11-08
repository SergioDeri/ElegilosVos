// Marco de las pantallas de acceso (login, registro, verificar y elegir club):
// la caja centrada sobre la cancha pixel, con el nombre de la app y el lema
// arriba. El contenido es un <main>.
import type { ReactNode } from "react";
import { FondoCancha } from "@/app/_cancha/fondo-cancha";
import estilos from "./acceso.module.css";

export function PantallaAcceso({ children }: { children: ReactNode }) {
  return (
    <div className={estilos.acceso}>
      <FondoCancha />
      <p className={estilos.marca}>
        Elegilos<span className={estilos.vos}>Vos</span>
      </p>
      <p className={estilos.lema}>¿Estás cansado de que tu DT haga cualquier cosa? Ahora elegí vos.</p>
      {children}
    </div>
  );
}
