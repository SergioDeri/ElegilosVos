// Pantallas de acceso (login, registro, verificar): la caja centrada sobre la
// cancha pixel, con el nombre de la app y el lema arriba.
import { FondoCancha } from "@/app/_cancha/fondo-cancha";
import estilos from "./acceso.module.css";

export default function LayoutAcceso({ children }: LayoutProps<"/">) {
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
