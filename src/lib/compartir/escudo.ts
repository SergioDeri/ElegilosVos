// Escudo de la Selección para las imágenes de compartir (Selección, ticket
// 12), como data URL para que el dibujo (Satori) no dependa de la red. Es el
// que subió el Admin (`club.escudo_path` de la fila `seleccion`, bucket
// `escudos`); si no hay o no se puede bajar, el PNG del repo
// (assets/escudos/seleccion.png, el mismo que valida el ticket 03).
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SELECCION } from "@/domain/comun/tipos";
import { leerEscudoDelClub } from "@/lib/club/lecturas";
import { urlEscudo } from "@/lib/imagenes/subida";
import type { Database } from "@/lib/supabase/database.types";

const aDataUrl = (bytes: Uint8Array) => `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;

async function delBucket(cliente: SupabaseClient<Database>): Promise<string | null> {
  try {
    const url = urlEscudo(cliente, await leerEscudoDelClub(cliente, SELECCION));
    if (!url) return null;
    const respuesta = await fetch(url, { cache: "no-store" });
    if (!respuesta.ok) return null;
    return aDataUrl(new Uint8Array(await respuesta.arrayBuffer()));
  } catch {
    return null;
  }
}

/** El PNG del repo (assets/escudos/seleccion.png) como data URL, o null si no se puede leer. */
export async function escudoDeLaSeleccionDelRepo(): Promise<string | null> {
  try {
    return aDataUrl(await readFile(join(process.cwd(), "assets/escudos/seleccion.png")));
  } catch {
    return null;
  }
}

/** El escudo de la Selección como data URL PNG, o null si no hay ninguno. */
export async function escudoDeLaSeleccion(cliente: SupabaseClient<Database>): Promise<string | null> {
  return (await delBucket(cliente)) ?? (await escudoDeLaSeleccionDelRepo());
}
