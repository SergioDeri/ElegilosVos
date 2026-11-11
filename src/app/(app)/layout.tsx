// Layout de la app del Hincha. Toda página dentro de (app) exige sesión y que
// el Hincha haya elegido su hinchada (Club Favorito o "solo Selección"): sin
// sesión va al login, sin elegir a /elegir-club. (El proxy ya redirige sin
// sesión; esto es la verificación real del lado del servidor.) Las pantallas
// de un Club, además, llaman a requerirHincha(), que manda a la Selección al
// Hincha sin Club. Las Server Actions igual tienen que llamar a
// requerirHincha() o requerirHinchada(): los layouts no protegen las acciones.
//
// Hincha sin Club (Selección, ticket 06): la marca lleva a la Selección y no
// hay selector "mi club / Selección" ni links a pantallas de un Club. Hincha
// con Club: el selector y, una vez por dispositivo, el aviso de la Selección.
//
// Notificaciones: mientras este navegador no las tenga activadas, un aviso
// arriba de todo invita a activarlas (ver aviso-notificaciones).
//
// Tema: los acentos y la barra del sistema toman los colores del Club
// Favorito (`data-club`, ver @/domain/pixel).
import type { Viewport } from "next";
import Link from "next/link";
import { colorDeSistema, temaDe } from "@/domain/pixel";
import { obtenerHincha, requerirHinchada } from "@/lib/auth/sesion";
import { inicioDelHincha } from "@/lib/auth/rutas";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { MenuUsuario } from "./_barra/menu-usuario";
import { SelectorHinchada } from "./_barra/selector-hinchada";
import { AvisoSeleccion } from "./_seleccion/aviso-seleccion";
import { AvisoNotificaciones } from "./cuenta/_notificaciones/aviso-notificaciones";
import barra from "./_barra/barra.module.css";

export async function generateViewport(): Promise<Viewport> {
  const hincha = await obtenerHincha();
  return { themeColor: colorDeSistema(hincha ? temaDe(hincha.clubFavorito) : "neutro") };
}

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const hincha = await requerirHinchada();
  const club = hincha.clubFavorito;
  return (
    <div data-club={temaDe(club)} className="app-hincha">
      <header className="barra-app">
        <Link href={inicioDelHincha(hincha)} className={barra.marca} aria-label="Elegilos Vos: ir al inicio">
          Elegilos<span className={barra.vos}>Vos</span>
        </Link>
        {club && <SelectorHinchada club={NOMBRE_CLUB[club]} />}
        <MenuUsuario conClub={club !== null} />
      </header>
      <AvisoNotificaciones clavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      {club && <AvisoSeleccion />}
      {children}
    </div>
  );
}
