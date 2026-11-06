// Sesión del Hincha del lado del servidor (Server Components, Server Actions,
// Route Handlers). Úsenlo en toda página o acción que necesite al Hincha:
//
//   const hincha = await requerirHincha();   // sesión + Club Favorito elegido
//   hincha.clubFavorito                       // "penarol" | "nacional"
//
// La autorización de los datos igual la hace RLS; esto es para la navegación.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { clubIdDeLaBase, type ClubId, type Rol } from "@/domain/comun/tipos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { RUTA_ELEGIR_CLUB, RUTA_LOGIN, RUTA_SESION_HUERFANA } from "./rutas";

export type HinchaEnSesion = {
  id: string;
  email: string | null;
  clubFavorito: ClubId | null;
  rol: Rol;
};

export type HinchaConClub = HinchaEnSesion & { clubFavorito: ClubId };

type Sesion =
  | { tipo: "sin-sesion" }
  /** JWT válido pero sin perfil: el usuario ya no existe (se borró). */
  | { tipo: "huerfana" }
  | { tipo: "hincha"; hincha: HinchaEnSesion };

/** La sesión del request actual. Una vez por request. */
const leerSesion = cache(async (): Promise<Sesion> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { tipo: "sin-sesion" };

  // RLS: el Hincha solo puede leer su propio perfil.
  const { data: perfil } = await supabase
    .from("perfil")
    .select("club_favorito_id, rol")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!perfil) return { tipo: "huerfana" };

  return {
    tipo: "hincha",
    hincha: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      clubFavorito: perfil.club_favorito_id === null ? null : clubIdDeLaBase(perfil.club_favorito_id),
      rol: perfil.rol,
    },
  };
});

/** El Hincha de la sesión actual, o null si no hay sesión válida. Una vez por request. */
export async function obtenerHincha(): Promise<HinchaEnSesion | null> {
  const sesion = await leerSesion();
  return sesion.tipo === "hincha" ? sesion.hincha : null;
}

/**
 * Exige sesión (si no, al login). Puede no tener Club Favorito todavía. Una
 * sesión huérfana se limpia antes de ir al login: si no, el proxy (que solo
 * mira la firma del JWT) la devolvería al inicio y quedaría en un bucle.
 */
export async function requerirSesion(): Promise<HinchaEnSesion> {
  const sesion = await leerSesion();
  if (sesion.tipo === "huerfana") redirect(RUTA_SESION_HUERFANA);
  if (sesion.tipo === "sin-sesion") redirect(RUTA_LOGIN);
  return sesion.hincha;
}

/** Exige sesión y Club Favorito elegido (si no, a elegirlo). */
export async function requerirHincha(): Promise<HinchaConClub> {
  const hincha = await requerirSesion();
  if (!hincha.clubFavorito) redirect(RUTA_ELEGIR_CLUB);
  return { ...hincha, clubFavorito: hincha.clubFavorito };
}
