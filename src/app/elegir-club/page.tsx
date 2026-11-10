// Elección del Club Favorito: exige sesión; si ya lo eligió, no hay nada que
// hacer acá (no se puede cambiar) y vuelve al inicio. Mismo marco que el login.
// La primera vez ofrece también "Quiero votar solo por la Selección" (Selección,
// ticket 06); quien la eligió vuelve acá para elegir Club más tarde (desde Mi
// cuenta o la invitación), y entonces solo ve los Clubes.
import Link from "next/link";
import { redirect } from "next/navigation";
import { PantallaAcceso } from "@/app/_acceso/pantalla-acceso";
import { BotonCerrarSesion } from "@/app/_sesion/boton-cerrar-sesion";
import { RUTA_INICIO, RUTA_SELECCION } from "@/lib/auth/rutas";
import { requerirSesion } from "@/lib/auth/sesion";
import { urlEscudo } from "@/lib/imagenes/subida";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioElegirClub } from "./formulario-elegir-club";

export default async function PaginaElegirClub() {
  const hincha = await requerirSesion();
  if (hincha.clubFavorito) redirect(RUTA_INICIO);

  const supabase = await crearClienteServidor();
  // La Selección vive en la misma tabla pero no es un Club: nunca es Club Favorito.
  const { data } = await supabase.from("club").select("id, nombre, escudo_path").eq("es_seleccion", false).order("nombre");
  // Sin escudo cargado (desde el backoffice, sección Clubes), se ve el hueco de "falta escudo".
  const clubes = (data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, escudo: urlEscudo(supabase, c.escudo_path) }));

  return (
    <PantallaAcceso>
      <main>
        <h1>¿De qué cuadro sos?</h1>
        <FormularioElegirClub clubes={clubes} ofrecerSoloSeleccion={!hincha.eligioSoloSeleccion} />
        {hincha.eligioSoloSeleccion ? (
          <p>
            <Link href={RUTA_SELECCION}>← Seguir solo con la Selección</Link>
          </p>
        ) : (
          <BotonCerrarSesion />
        )}
      </main>
    </PantallaAcceso>
  );
}
