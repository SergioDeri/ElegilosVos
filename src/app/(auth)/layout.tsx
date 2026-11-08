// Pantallas de acceso (login, registro, verificar): ver PantallaAcceso.
import { PantallaAcceso } from "@/app/_acceso/pantalla-acceso";

export default function LayoutAcceso({ children }: LayoutProps<"/">) {
  return <PantallaAcceso>{children}</PantallaAcceso>;
}
