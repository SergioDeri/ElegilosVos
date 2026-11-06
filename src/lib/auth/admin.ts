// Acceso del Admin al backoffice, del lado del servidor.
//
//   await requerirCuentaAdmin();     // layout de /admin: rol admin (con o sin 2FA)
//   await requerirAdmin();           // páginas del panel: rol admin + sesión AAL2
//   const supabase = await requerirAdminEnAccion();  // TODA Server Action de Admin
//
// Las páginas usan la sesión (claims) para navegar; las acciones preguntan a
// Postgres `es_admin()`, la misma regla que aplican las políticas de RLS.
import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerHincha, type HinchaEnSesion } from "./sesion";
import { decidirAccesoAdmin, RUTA_DOS_FACTORES, type AccesoAdmin } from "./acceso-admin";
import { RUTA_LOGIN } from "./rutas";

/** Estado de acceso al backoffice de la sesión actual (una vez por request). */
export const obtenerAccesoAdmin = cache(async (): Promise<{ acceso: AccesoAdmin; hincha: HinchaEnSesion | null }> => {
  const hincha = await obtenerHincha();
  if (!hincha) return { acceso: decidirAccesoAdmin(null), hincha };
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const aal = typeof data?.claims?.aal === "string" ? data.claims.aal : null;
  return { acceso: decidirAccesoAdmin({ rol: hincha.rol, aal }), hincha };
});

/** Exige una cuenta Admin (aunque todavía no haya verificado el 2FA). Si no, 404. */
export async function requerirCuentaAdmin(): Promise<{ hincha: HinchaEnSesion; conDosFactores: boolean }> {
  const { acceso, hincha } = await obtenerAccesoAdmin();
  if (acceso.tipo === "login" || !hincha) redirect(`${RUTA_LOGIN}?next=${encodeURIComponent("/admin")}`);
  if (acceso.tipo === "denegado") notFound();
  return { hincha, conDosFactores: acceso.tipo === "admin" };
}

/** Exige Admin con 2FA verificado en la sesión; si falta, al enrolamiento/verificación. */
export async function requerirAdmin(): Promise<HinchaEnSesion> {
  const { hincha, conDosFactores } = await requerirCuentaAdmin();
  if (!conDosFactores) redirect(RUTA_DOS_FACTORES);
  return hincha;
}

export class AccesoDenegado extends Error {
  constructor() {
    super("Solo el Admin con 2FA puede hacer esto.");
  }
}

/**
 * Para Server Actions: verifica en Postgres que la sesión sea de un Admin con
 * 2FA (`es_admin()`) y devuelve el cliente de Supabase de esa sesión (con
 * RLS). Lanza AccesoDenegado si no. No confía en el layout.
 */
export async function requerirAdminEnAccion() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("es_admin");
  if (error || data !== true) throw new AccesoDenegado();
  return supabase;
}
