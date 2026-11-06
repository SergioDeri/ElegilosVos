// Usuarios de prueba para los tests de RLS. Se crean con la service role,
// así que no pasan por el registro real (eso lo prueba el ticket 04).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ClubId, Rol } from "@/domain/comun/tipos";
import type { EntornoSupabase } from "./entorno";

export type Cliente = SupabaseClient<Database>;

export const CONTRASENA_DE_PRUEBA = "contrasena-de-prueba-123";

/** Los tres usuarios estándar que crea el setup global una vez por corrida. */
export const USUARIOS_ESTANDAR = {
  hinchaPenarol: { email: "hincha.penarol@rls.test", club: "penarol", rol: "hincha" },
  hinchaNacional: { email: "hincha.nacional@rls.test", club: "nacional", rol: "hincha" },
  admin: { email: "admin@rls.test", club: "penarol", rol: "admin" },
} as const satisfies Record<string, { email: string; club: ClubId | null; rol: Rol }>;

export type NombreUsuarioEstandar = keyof typeof USUARIOS_ESTANDAR;

export function clienteDeServicio(entorno: EntornoSupabase): Cliente {
  return createClient<Database>(entorno.url, entorno.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente anónimo, o autenticado con un access token ya emitido. */
export function clienteConToken(entorno: EntornoSupabase, accessToken?: string): Cliente {
  return createClient<Database>(entorno.url, entorno.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

async function buscarUsuarioPorEmail(servicio: Cliente, email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await servicio.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const encontrado = data.users.find((u) => u.email === email);
    if (encontrado) return encontrado;
    if (data.users.length < 1000) return null;
  }
}

export type UsuarioDePrueba = {
  id: string;
  email: string;
  accessToken: string;
};

/**
 * Crea (o recrea, si quedó de una corrida anterior) un usuario confirmado,
 * le asigna Club Favorito y rol con la service role, e inicia sesión.
 * Cuidado: cada llamada hace un login real y Auth limita los logins por IP
 * (auth.rate_limit.sign_in_sign_ups en supabase/config.toml). Para los casos
 * comunes usá los usuarios estándar de `clienteComo()`.
 */
export async function crearUsuarioDePrueba(
  entorno: EntornoSupabase,
  opciones: { email: string; club: ClubId | null; rol: Rol },
): Promise<UsuarioDePrueba> {
  const servicio = clienteDeServicio(entorno);

  const previo = await buscarUsuarioPorEmail(servicio, opciones.email);
  if (previo) await servicio.auth.admin.deleteUser(previo.id);

  const { data: creado, error: errorAlCrear } = await servicio.auth.admin.createUser({
    email: opciones.email,
    password: CONTRASENA_DE_PRUEBA,
    email_confirm: true,
  });
  if (errorAlCrear) throw errorAlCrear;
  const id = creado.user.id;

  const { error: errorPerfil } = await servicio
    .from("perfil")
    .update({ club_favorito_id: opciones.club, rol: opciones.rol })
    .eq("id", id);
  if (errorPerfil) throw errorPerfil;

  const anonimo = clienteConToken(entorno);
  const { data: sesion, error: errorLogin } = await anonimo.auth.signInWithPassword({
    email: opciones.email,
    password: CONTRASENA_DE_PRUEBA,
  });
  if (errorLogin) throw errorLogin;

  return { id, email: opciones.email, accessToken: sesion.session.access_token };
}

export async function borrarUsuarioDePrueba(entorno: EntornoSupabase, id: string) {
  const { error } = await clienteDeServicio(entorno).auth.admin.deleteUser(id);
  if (error && error.status !== 404) throw error;
}
