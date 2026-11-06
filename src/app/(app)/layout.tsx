// Layout de la app del Hincha. Toda página dentro de (app) exige sesión y
// Club Favorito elegido: sin sesión va al login, sin Club a /elegir-club.
// (El proxy ya redirige sin sesión; esto es la verificación real del lado
// del servidor.) Las Server Actions de estas páginas igual tienen que llamar
// a requerirHincha(): los layouts no protegen las acciones.
//
// Tema: los acentos y la barra del sistema toman los colores del Club
// Favorito (`data-club`, ver @/domain/pixel).
import type { Viewport } from "next";
import Link from "next/link";
import { colorDeSistema, temaDe } from "@/domain/pixel";
import { obtenerHincha, requerirHincha } from "@/lib/auth/sesion";
import { BotonCerrarSesion } from "@/app/_sesion/boton-cerrar-sesion";
import { Icono } from "@/app/_pixel/icono";

export async function generateViewport(): Promise<Viewport> {
  const hincha = await obtenerHincha();
  return { themeColor: colorDeSistema(hincha ? temaDe(hincha.clubFavorito) : "neutro") };
}

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const hincha = await requerirHincha();
  return (
    <div data-club={temaDe(hincha.clubFavorito)}>
      <header className="barra-app">
        <Link href="/cuenta">
          <Icono nombre="menu" />
          Mi cuenta
        </Link>
        <BotonCerrarSesion />
      </header>
      {children}
    </div>
  );
}
