// Autorización compartida de los endpoints de cron (src/app/api/cron/*): `Authorization: Bearer <CRON_SECRET>`
// (lo que manda Vercel Cron). Comparación en tiempo constante sobre los
// hashes, para no filtrar el largo ni el contenido del secreto. Sin secreto
// configurado, rechaza todo.
import { createHash, timingSafeEqual } from "node:crypto";

const hash = (texto: string) => createHash("sha256").update(texto).digest();

export function cronAutorizado(request: Request, secreto: string | undefined): boolean {
  if (!secreto) return false;
  const recibido = request.headers.get("authorization") ?? "";
  return timingSafeEqual(hash(recibido), hash(`Bearer ${secreto}`));
}
