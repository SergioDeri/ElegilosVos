// Elección del Club Favorito: exige sesión; si ya lo eligió, no hay nada que
// hacer acá (no se puede cambiar) y vuelve al inicio.
import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth/sesion";
import { RUTA_INICIO } from "@/lib/auth/rutas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioElegirClub } from "./formulario-elegir-club";
import { BotonCerrarSesion } from "@/app/_sesion/boton-cerrar-sesion";

export default async function PaginaElegirClub() {
  const hincha = await requerirSesion();
  if (hincha.clubFavorito) redirect(RUTA_INICIO);

  const supabase = await crearClienteServidor();
  const { data: clubes } = await supabase.from("club").select("id, nombre").order("nombre");

  return (
    <main>
      <h1>¿De qué cuadro sos?</h1>
      <FormularioElegirClub clubes={clubes ?? []} />
      <BotonCerrarSesion />
    </main>
  );
}
