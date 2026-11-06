// Regla de acceso al backoffice, sin dependencias (se testea sola). La usa
// src/lib/auth/admin.ts para la navegación. La autorización real de los
// datos la hace Postgres con `public.es_admin()` (rol admin + sesión AAL2).
import type { Rol } from "@/domain/comun/tipos";

export type AccesoAdmin =
  | { tipo: "login" }
  | { tipo: "denegado" }
  | { tipo: "dos-factores" }
  | { tipo: "admin" };

export const RUTA_ADMIN = "/admin";
export const RUTA_DOS_FACTORES = "/admin/2fa";

export function decidirAccesoAdmin(sesion: { rol: Rol; aal: string | null } | null): AccesoAdmin {
  if (!sesion) return { tipo: "login" };
  if (sesion.rol !== "admin") return { tipo: "denegado" };
  if (sesion.aal !== "aal2") return { tipo: "dos-factores" };
  return { tipo: "admin" };
}
