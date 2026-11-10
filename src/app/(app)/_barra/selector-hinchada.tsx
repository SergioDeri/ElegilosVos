"use client";

// Selector "mi club / Selección" de la barra (Hinchas con Club Favorito): dos
// links, el de la pantalla actual marcado. Todo lo que cuelga de /seleccion es
// la Selección; el resto, el Club.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NOMBRE_SELECCION } from "@/domain/comun/textos";
import { RUTA_SELECCION } from "@/lib/auth/rutas";
import estilos from "./barra.module.css";

export function SelectorHinchada({ club }: { club: string }) {
  const ruta = usePathname();
  const enSeleccion = ruta === RUTA_SELECCION || ruta.startsWith(`${RUTA_SELECCION}/`);
  return (
    <nav aria-label="Club o Selección" className={estilos.selector}>
      <Link href="/" aria-current={enSeleccion ? undefined : "page"}>
        {club}
      </Link>
      <Link href={RUTA_SELECCION} aria-current={enSeleccion ? "page" : undefined}>
        {NOMBRE_SELECCION}
      </Link>
    </nav>
  );
}
