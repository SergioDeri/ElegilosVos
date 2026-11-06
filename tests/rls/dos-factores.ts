// 2FA (TOTP) para los tests de RLS: permite obtener una sesión AAL2, que es lo
// que exige `public.es_admin()`. Uso:
//
//   import { crearAdminConDosFactores, borrarUsuario } from "./helpers";
//   const admin = await crearAdminConDosFactores();     // null si TOTP está apagado
//   await admin.cliente.from("jugador").insert(...);     // es_admin() = true
//   await borrarUsuario(admin.id);
//
// TOTP (RFC 6238) implementado con node:crypto, sin dependencias.
import { createHmac } from "node:crypto";
import type { ClubId, Rol } from "@/domain/comun/tipos";
import {
  borrarUsuarioDePrueba,
  clienteConToken,
  CONTRASENA_DE_PRUEBA,
  crearUsuarioDePrueba,
  type Cliente,
} from "./usuarios";
import type { EntornoSupabase } from "./entorno";

function decodificarBase32(texto: string): Buffer {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of texto.replace(/=+$/, "").toUpperCase()) {
    const v = alfabeto.indexOf(c);
    if (v < 0) throw new Error(`Base32 inválido: ${c}`);
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Código TOTP de 6 dígitos (SHA-1, paso de 30 s) para un secreto en base32. */
export function codigoTotp(secretoBase32: string, momento = Date.now()): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(momento / 1000 / 30)));
  const hmac = createHmac("sha1", decodificarBase32(secretoBase32)).update(contador).digest();
  const desde = hmac[hmac.length - 1] & 0x0f;
  const valor = (hmac.readUInt32BE(desde) & 0x7fffffff) % 1_000_000;
  return valor.toString().padStart(6, "0");
}

export type UsuarioConDosFactores = {
  id: string;
  email: string;
  /** Cliente con sesión AAL2 (token ya verificado con TOTP). */
  cliente: Cliente;
  accessToken: string;
};

/**
 * Crea un usuario descartable con el rol pedido (por defecto admin), le enrola
 * un factor TOTP y lo verifica: devuelve un cliente con sesión AAL2.
 * Devuelve null si Supabase local tiene TOTP apagado (`[auth.mfa.totp]` en
 * supabase/config.toml; hace falta reiniciar Supabase después de cambiarlo).
 * Hace dos logins reales: usar con moderación. Borralo con `borrarUsuario`.
 */
export async function crearUsuarioConDosFactores(
  entorno: EntornoSupabase,
  opciones: { club: ClubId | null; rol: Rol },
): Promise<UsuarioConDosFactores | null> {
  const email = `aal2.${crypto.randomUUID()}@rls.test`;
  const { id } = await crearUsuarioDePrueba(entorno, { email, ...opciones });

  // Cliente con sesión en memoria (la API de MFA necesita la sesión completa).
  const conSesion = clienteConToken(entorno);
  const { error: errorLogin } = await conSesion.auth.signInWithPassword({ email, password: CONTRASENA_DE_PRUEBA });
  if (errorLogin) throw errorLogin;

  const { data: factor, error: errorEnrolar } = await conSesion.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "tests-rls",
  });
  if (errorEnrolar) {
    if (/not_enabled|disabled|not enabled/i.test(`${errorEnrolar.code} ${errorEnrolar.message}`)) {
      console.warn(`[dos-factores] TOTP deshabilitado en Supabase local (${errorEnrolar.message}).`);
      await borrarUsuarioDePrueba(entorno, id);
      return null;
    }
    throw errorEnrolar;
  }

  const { data: verificado, error: errorVerificar } = await conSesion.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: codigoTotp(factor.totp.secret),
  });
  if (errorVerificar) throw errorVerificar;

  return { id, email, accessToken: verificado.access_token, cliente: clienteConToken(entorno, verificado.access_token) };
}
