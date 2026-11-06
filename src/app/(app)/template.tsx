// Transición entre pantallas del Hincha (ticket 09): el template se vuelve a
// montar en cada navegación y entra con un barrido por bloques. Con
// "reducir movimiento", la pantalla aparece al instante.
import estilos from "@/app/_pixel/efectos.module.css";

export default function Template({ children }: { children: React.ReactNode }) {
  return <div className={estilos.transicion}>{children}</div>;
}
