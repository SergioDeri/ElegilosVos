// API para los archivos de test de RLS. Uso típico:
//
//   import { clienteAnonimo, clienteComo, usuario } from "./helpers";
//   const penarol = clienteComo("hinchaPenarol");
//   const { data, error } = await penarol.from("perfil").select();
//
// Los usuarios estándar existen durante toda la corrida (los crea
// setup-global.ts). No modifiques su perfil en un test sin restaurarlo;
// para escenarios destructivos (borrar cuenta, cambiar rol) creá uno propio
// con `crearUsuario()` y borralo al final con `borrarUsuario()`.
import { inject } from "vitest";
import type { ClubId, Rol } from "@/domain/comun/tipos";
import { crearUsuarioConDosFactores } from "./dos-factores";
import {
  borrarUsuarioDePrueba,
  clienteConToken,
  clienteDeServicio,
  crearUsuarioDePrueba,
  type Cliente,
  type NombreUsuarioEstandar,
} from "./usuarios";

export type { Cliente, NombreUsuarioEstandar };

export function entorno() {
  return inject("entornoSupabase");
}

/** Cliente sin sesión (rol `anon`). */
export function clienteAnonimo(): Cliente {
  return clienteConToken(entorno());
}

/** Cliente con la service role: saltea RLS. Solo para preparar o limpiar datos. */
export function clienteServicio(): Cliente {
  return clienteDeServicio(entorno());
}

/**
 * Cliente autenticado como uno de los usuarios estándar.
 * Ojo: el Admin estándar tiene sesión AAL1 (sin 2FA); `es_admin()` le da false.
 */
export function clienteComo(nombre: NombreUsuarioEstandar): Cliente {
  return clienteConToken(entorno(), inject("usuariosEstandar")[nombre].accessToken);
}

/** Id y email de un usuario estándar. */
export function usuario(nombre: NombreUsuarioEstandar) {
  const { id, email } = inject("usuariosEstandar")[nombre];
  return { id, email };
}

/** Crea un usuario descartable (hace un login real: usar con moderación). */
export async function crearUsuario(opciones: { club: ClubId | null; rol?: Rol; email?: string }) {
  const email = opciones.email ?? `descartable.${crypto.randomUUID()}@rls.test`;
  const creado = await crearUsuarioDePrueba(entorno(), {
    email,
    club: opciones.club,
    rol: opciones.rol ?? "hincha",
  });
  return { ...creado, cliente: clienteConToken(entorno(), creado.accessToken) };
}

export async function borrarUsuario(id: string) {
  await borrarUsuarioDePrueba(entorno(), id);
}

/**
 * Admin descartable con sesión AAL2 (2FA TOTP verificado): `es_admin()` le da
 * true. Devuelve null si Supabase local tiene TOTP apagado (en ese caso
 * salteá los tests que lo necesitan). Borralo al final con `borrarUsuario`.
 */
export async function crearAdminConDosFactores(opciones: { club?: ClubId | null } = {}) {
  return crearUsuarioConDosFactores(entorno(), { club: opciones.club ?? "penarol", rol: "admin" });
}
