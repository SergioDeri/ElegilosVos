// Ficha de un Jugador en el backoffice: datos, Disponibilidad, foto y baja.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { esClubId } from "@/domain/comun/tipos";
import { cambiarEnPlantel, quitarFoto } from "../../acciones";
import { FormularioDatos, FormularioDisponibilidad, FormularioFoto } from "../../_componentes/formularios";
import { esUuid } from "@/domain/comun/ids";

export default async function PaginaJugador({ params, searchParams }: PageProps<"/admin/jugadores/[id]">) {
  await requerirAdmin();
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await crearClienteServidor();
  const { data: jugador, error } = await supabase.from("jugador").select().eq("id", id).maybeSingle();
  if (error) throw error;
  if (!jugador || !esClubId(jugador.club_id)) notFound();

  const urlFoto = jugador.foto_path ? supabase.storage.from("jugadores").getPublicUrl(jugador.foto_path).data.publicUrl : null;

  return (
    <main>
      <h1>
        {jugador.numero}. {jugador.nombre}
      </h1>
      <p>
        Plantel de {NOMBRE_CLUB[jugador.club_id]} ·{" "}
        {jugador.en_plantel ? "En el Plantel" : "Dado de baja (no se puede elegir en las Alineaciones)"}
      </p>
      {aviso === "foto" && <p role="alert">El Jugador se dio de alta, pero no se pudo subir la foto. Probá de nuevo.</p>}

      <h2>Datos</h2>
      <FormularioDatos id={jugador.id} nombre={jugador.nombre} numero={jugador.numero} posicionNatural={jugador.posicion_natural} />

      <h2>Disponibilidad</h2>
      <p>Cada cambio de Disponibilidad queda registrado para avisar a los Hinchas.</p>
      <FormularioDisponibilidad id={jugador.id} disponibilidad={jugador.disponibilidad} motivo={jugador.motivo_disponibilidad} />

      <h2>Foto</h2>
      {urlFoto ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- UI mínima; la etapa de diseño decide */}
          <img src={urlFoto} alt={`Foto de ${jugador.nombre}`} width={120} />
          <form action={quitarFoto.bind(null, jugador.id)}>
            <button type="submit">Quitar foto</button>
          </form>
        </>
      ) : (
        <p>Sin foto.</p>
      )}
      <FormularioFoto id={jugador.id} />

      <h2>Plantel</h2>
      <form action={cambiarEnPlantel.bind(null, jugador.id, !jugador.en_plantel)}>
        <button type="submit">{jugador.en_plantel ? "Dar de baja del Plantel" : "Reincorporar al Plantel"}</button>
      </form>

      <p>
        <Link href={`/admin/planteles/${jugador.club_id}`}>Volver al Plantel</Link>
      </p>
    </main>
  );
}
