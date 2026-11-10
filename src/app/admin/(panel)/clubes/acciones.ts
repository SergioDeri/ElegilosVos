"use server";

// Escudo de cada Club y de la Selección (diseño pixel art, ticket 07). Como toda acción del
// backoffice, empieza con requerirAdminEnAccion(): Postgres verifica que sea
// Admin con 2FA y la escritura va con el cliente de esa sesión (RLS).
import { refresh } from "next/cache";
import { esClubOSeleccion, type ClubOSeleccion } from "@/domain/comun/tipos";
import { requerirAdminEnAccion } from "@/lib/auth/admin";
import { MENSAJE_ESCUDO, archivoElegido, leerEscudo, subirEscudo } from "@/lib/imagenes/subida";

export type EstadoEscudoClub = { error?: string; mensaje?: string; ok?: boolean };

/** Sube el escudo del Club o de la Selección (o lo reemplaza: el anterior se borra del bucket). */
export async function cambiarEscudoDelClub(club: ClubOSeleccion, _previo: EstadoEscudoClub, formData: FormData): Promise<EstadoEscudoClub> {
  const supabase = await requerirAdminEnAccion();
  if (!esClubOSeleccion(club)) return { mensaje: "Club inválido." };

  const archivo = archivoElegido(formData, "escudo");
  if (!archivo) return { error: "Elegí un escudo." };
  const escudo = await leerEscudo(archivo);
  if (!escudo.ok) return { error: MENSAJE_ESCUDO[escudo.motivo] };

  const { data: actual, error } = await supabase.from("club").select("escudo_path").eq("id", club).single();
  if (error) return { mensaje: "No se pudo leer el Club." };

  const guardado = await subirEscudo(supabase, {
    carpeta: `clubes/${club}`,
    escudo,
    anterior: actual.escudo_path,
    asignar: async (ruta) => {
      const { data, error: errorAsignar } = await supabase.from("club").update({ escudo_path: ruta }).eq("id", club).select("id");
      return !errorAsignar && data.length > 0;
    },
  });
  if (!guardado) return { mensaje: "No se pudo subir el escudo." };
  refresh();
  return { ok: true, mensaje: "Escudo guardado." };
}
