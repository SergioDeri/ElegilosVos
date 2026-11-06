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
import { RUTA_ELEGIR_CLUB, RUTA_LOGIN } from "./rutas";

export type HinchaEnSesion = {
  id: string;
  email: string | null;
  clubFavorito: ClubId | null;
  rol: Rol;
};

export type HinchaConClub = HinchaEnSesion & { clubFavorito: ClubId };

/** El Hincha de la sesión actual, o null si no hay sesión válida. Una vez por request. */
export const obtenerHincha = cache(async (): Promise<HinchaEnSesion | null> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  // RLS: el Hincha solo puede leer su propio perfil.
  const { data: perfil } = await supabase
    .from("perfil")
    .select("club_favorito_id, rol")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!perfil) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    clubFavorito: perfil.club_favorito_id === null ? null : clubIdDeLaBase(perfil.club_favorito_id),
    rol: perfil.rol,
  };
});

/** Exige sesión (si no, al login). Puede no tener Club Favorito todavía. */
export async function requerirSesion(): Promise<HinchaEnSesion> {
  const hincha = await obtenerHincha();
  if (!hincha) redirect(RUTA_LOGIN);
  return hincha;
}

/** Exige sesión y Club Favorito elegido (si no, a elegirlo). */
export async function requerirHincha(): Promise<HinchaConClub> {
  const hincha = await requerirSesion();
  if (!hincha.clubFavorito) redirect(RUTA_ELEGIR_CLUB);
  return { ...hincha, clubFavorito: hincha.clubFavorito };
}
