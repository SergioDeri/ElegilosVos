// Subida de escudos (de Club y de Rival) desde el backoffice. Se valida el
// contenido real con `validarEscudo` (PNG de exactamente 48x48) y se sube con
// el cliente de la sesión del Admin (RLS del bucket `escudos`).
import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CABECERA_ESCUDO, validarEscudo, type MotivoEscudoInvalido, type ResultadoEscudo } from "@/domain/planteles";
import type { Database } from "@/lib/supabase/database.types";

export const BUCKET_ESCUDOS = "escudos";

/** URL pública de un escudo (de Club o de Rival) del bucket, o null si no hay. */
export function urlEscudo(supabase: SupabaseClient<Database>, path: string | null): string | null {
  return path ? supabase.storage.from(BUCKET_ESCUDOS).getPublicUrl(path).data.publicUrl : null;
}

/** Mensaje para el Admin por cada motivo de rechazo. */
export const MENSAJE_ESCUDO: Record<MotivoEscudoInvalido, string> = {
  vacia: "El archivo está vacío.",
  tamano: "El escudo no puede pesar más de 64 KB.",
  formato: "El escudo tiene que ser un PNG.",
  dimensiones: "El escudo tiene que medir exactamente 48x48 píxeles.",
};

/** El archivo del campo si se eligió uno (los inputs vacíos mandan un File de 0 bytes sin nombre). */
export function archivoElegido(formData: FormData, campo: string): File | null {
  const valor = formData.get(campo);
  return valor instanceof File && (valor.size > 0 || valor.name) ? valor : null;
}

export type EscudoLeido = Extract<ResultadoEscudo, { ok: true }> & { bytes: Uint8Array };

/** Lee el archivo y valida su contenido. */
export async function leerEscudo(archivo: File): Promise<EscudoLeido | Extract<ResultadoEscudo, { ok: false }>> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const resultado = validarEscudo({ tamano: bytes.byteLength, cabecera: bytes.subarray(0, CABECERA_ESCUDO) });
  return resultado.ok ? { ...resultado, bytes } : resultado;
}

/**
 * Sube el escudo al bucket `escudos` en `carpeta/<uuid>.png` y lo asigna con
 * `asignar(ruta)` (que devuelve si actualizó la fila). Si no se pudo asignar,
 * borra la subida; si se asignó, borra el escudo `anterior`.
 */
export async function subirEscudo(
  supabase: SupabaseClient<Database>,
  opciones: {
    carpeta: string;
    escudo: EscudoLeido;
    anterior: string | null;
    asignar: (ruta: string) => Promise<boolean>;
  },
): Promise<boolean> {
  const { carpeta, escudo, anterior, asignar } = opciones;
  const ruta = `${carpeta}/${randomUUID()}.${escudo.extension}`;
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_ESCUDOS)
    .upload(ruta, escudo.bytes, { contentType: escudo.tipo, upsert: false });
  if (errorSubida) return false;

  if (!(await asignar(ruta))) {
    await supabase.storage.from(BUCKET_ESCUDOS).remove([ruta]);
    return false;
  }
  if (anterior) await supabase.storage.from(BUCKET_ESCUDOS).remove([anterior]);
  return true;
}
