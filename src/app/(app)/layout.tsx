// Layout de la app del Hincha. Toda página dentro de (app) exige sesión y
// Club Favorito elegido: sin sesión va al login, sin Club a /elegir-club.
// (El proxy ya redirige sin sesión; esto es la verificación real del lado
// del servidor.) Las Server Actions de estas páginas igual tienen que llamar
// a requerirHincha(): los layouts no protegen las acciones.
import Link from "next/link";
import { requerirHincha } from "@/lib/auth/sesion";
import { BotonCerrarSesion } from "@/app/_sesion/boton-cerrar-sesion";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  await requerirHincha();
  return (
    <>
      <header>
        <Link href="/cuenta">Mi cuenta</Link>
        <BotonCerrarSesion />
      </header>
      {children}
    </>
  );
}
