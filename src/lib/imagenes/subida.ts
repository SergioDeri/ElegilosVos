// Subida de imágenes del backoffice (escudos). Se
// valida el contenido real con `validarFoto` (JPEG/PNG/WebP de hasta 2 MB) y
// se sube con el cliente de la sesión del Admin (RLS del bucket).
import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validarFoto, type ResultadoFoto } from "@/domain/planteles";
import type { Database } from "@/lib/supabase/database.types";

/** El archivo del campo si se eligió uno (los inputs vacíos mandan un File de 0 bytes sin nombre). */
export function archivoElegido(formData: FormData, campo: string): File | null {
  const valor = formData.get(campo);
  return valor instanceof File && (valor.size > 0 || valor.name) ? valor : null;
}

export type ImagenLeida = Extract<ResultadoFoto, { ok: true }> & { bytes: Uint8Array };

/** Lee el archivo y valida su contenido. */
export async function leerImagen(archivo: File): Promise<ImagenLeida | Extract<ResultadoFoto, { ok: false }>> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const resultado = validarFoto({ tamano: bytes.byteLength, cabecera: bytes.subarray(0, 12) });
  return resultado.ok ? { ...resultado, bytes } : resultado;
}

/**
 * Sube la imagen a `bucket` en `carpeta/<uuid>.<extensión>` y la asigna con
 * `asignar(ruta)` (que devuelve si actualizó la fila). Si no se pudo asignar,
 * borra la subida; si se asignó, borra la imagen `anterior`.
 */
export async function subirImagen(
  supabase: SupabaseClient<Database>,
  opciones: {
    bucket: string;
    carpeta: string;
    imagen: ImagenLeida;
    anterior: string | null;
    asignar: (ruta: string) => Promise<boolean>;
  },
): Promise<boolean> {
  const { bucket, carpeta, imagen, anterior, asignar } = opciones;
  const ruta = `${carpeta}/${randomUUID()}.${imagen.extension}`;
  const { error: errorSubida } = await supabase.storage
    .from(bucket)
    .upload(ruta, imagen.bytes, { contentType: imagen.tipo, upsert: false });
  if (errorSubida) return false;

  if (!(await asignar(ruta))) {
    await supabase.storage.from(bucket).remove([ruta]);
    return false;
  }
  if (anterior) await supabase.storage.from(bucket).remove([anterior]);
  return true;
}
