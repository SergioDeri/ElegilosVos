// Traduce los errores de Supabase Auth a mensajes para el Hincha.
// Recibe la forma mínima de AuthError ({ code, status }) para no depender
// de supabase-js.

const MENSAJES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  email_not_confirmed: "Tenés que verificar tu email antes de entrar.",
  over_email_send_rate_limit: "Ya te mandamos un código hace poco. Esperá un minuto y volvé a pedirlo.",
  over_request_rate_limit: "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
  otp_expired: "El código es incorrecto o venció.",
  // También sale si la contraseña aparece en filtraciones conocidas (Leaked
  // password protection), no solo por el largo.
  weak_password: "Esa contraseña es muy débil o aparece en filtraciones conocidas: elegí otra de al menos 8 caracteres.",
  user_already_exists: "Ya hay una cuenta con ese email. Iniciá sesión.",
  email_exists: "Ya hay una cuenta con ese email. Iniciá sesión.",
  same_password: "La contraseña nueva tiene que ser distinta de la anterior.",
  validation_failed: "Revisá los datos ingresados.",
  email_address_invalid: "El email no es válido.",
  signup_disabled: "El registro está deshabilitado por ahora.",
};

const SIN_CONEXION = "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.";

export function mensajeDeErrorAuth(error: { code?: string; status?: number }): string {
  if (error.code && MENSAJES[error.code]) return MENSAJES[error.code];
  if (error.status === 429) return MENSAJES.over_request_rate_limit;
  // supabase-js usa status 0 cuando el pedido ni llegó (sin red, bloqueado).
  if (error.status === 0) return SIN_CONEXION;
  // Un error que no conocemos: el código (o el status) queda a la vista para
  // que el Hincha lo pueda reportar y se pueda buscar en los logs de Auth.
  const referencia = error.code ?? (error.status ? `HTTP ${error.status}` : null);
  return referencia ? `Algo salió mal (${referencia}). Probá de nuevo.` : "Algo salió mal. Probá de nuevo.";
}
