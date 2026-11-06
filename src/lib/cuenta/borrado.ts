// Borrado de cuenta del Hincha (ticket 13).
//
// El único id que se borra es el del usuario de la SESIÓN, validado contra
// Supabase Auth (`getUser()`); nunca uno que venga del cliente. Borrar el
// usuario de Auth borra en cascada su perfil y, desde el perfil, todas sus
// Alineaciones (y cualquier tabla futura que referencie al Hincha con
// `on delete cascade`: ver la sección del ticket 13 en el README).
//
// No importa `server-only` para poder probarlo desde tests/rls, pero el
// cliente `admin` que recibe es el de la service role (`crearClienteAdmin()`):
// llamarlo solo desde código de servidor.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Cliente = SupabaseClient<Database>;

export type ResultadoBorrado =
  | { ok: true; id: string }
  | { ok: false; motivo: "sin-sesion" | "es-admin" | "error"; mensaje: string };

/**
 * Borra la cuenta del usuario de la sesión de `sesion`.
 * @param sesion cliente con la sesión del Hincha (anon key + su sesión).
 * @param admin cliente con la service role (solo servidor).
 */
export async function borrarCuentaDeSesion(sesion: Cliente, admin: Cliente): Promise<ResultadoBorrado> {
  const { data, error: errorSesion } = await sesion.auth.getUser();
  const id = data.user?.id;
  if (errorSesion || !id) {
    return { ok: false, motivo: "sin-sesion", mensaje: "Tu sesión venció. Volvé a entrar para borrar tu cuenta." };
  }

  const { data: perfil, error: errorPerfil } = await sesion.from("perfil").select("rol").eq("id", id).maybeSingle();
  if (errorPerfil) {
    return { ok: false, motivo: "error", mensaje: "No pudimos borrar tu cuenta. Probá de nuevo en un rato." };
  }
  // Un Admin no se borra desde la app: el sistema podría quedar sin Admin.
  if (perfil?.rol === "admin") {
    return {
      ok: false,
      motivo: "es-admin",
      mensaje: "Sos Admin: tu cuenta no se puede borrar desde la app. Primero hay que quitarte el rol de Admin.",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return { ok: false, motivo: "error", mensaje: "No pudimos borrar tu cuenta. Probá de nuevo en un rato." };
  }
  return { ok: true, id };
}
