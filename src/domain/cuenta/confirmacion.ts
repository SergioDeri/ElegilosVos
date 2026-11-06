/** Palabra de confirmación para cuentas sin email. */
const PALABRA_DE_CONFIRMACION = "BORRAR";

/**
 * Texto que el Hincha tiene que escribir para confirmar el borrado: su email
 * (así no se confirma por reflejo) o, si la cuenta no tiene email, BORRAR.
 */
export function confirmacionDeBorrado(email: string | null): string {
  return email ?? PALABRA_DE_CONFIRMACION;
}

const normalizar = (texto: string) => texto.trim().toLowerCase();

/** ¿Lo que escribió el Hincha confirma el borrado? Ignora mayúsculas y espacios alrededor. */
export function confirmaBorrado(escrito: string, email: string | null): boolean {
  return normalizar(escrito) === normalizar(confirmacionDeBorrado(email));
}
