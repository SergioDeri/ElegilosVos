// Identificadores de la base (uuid). Validarlos antes de consultar evita que
// Postgres rechace el valor con un error (y deja responder "no existe").

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Si el valor tiene forma de uuid (por ejemplo, un id que llega en la URL o en un formulario). */
export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}
