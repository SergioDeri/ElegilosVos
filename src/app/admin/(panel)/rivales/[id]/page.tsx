// Ficha de un Rival: datos, escudo, baja lógica y borrado (sin Partidos).
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esClubId } from "@/domain/comun/tipos";
import { borrarRival, cambiarActivoRival, quitarEscudo } from "../../_partidos/acciones";
import { urlEscudo } from "../../_partidos/datos";
import { FormularioEscudo, FormularioRival } from "../../_partidos/formularios";
import { esUuid } from "@/domain/comun/ids";

export default async function PaginaRival({ params, searchParams }: PageProps<"/admin/rivales/[id]">) {
  await requerirAdmin();
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await crearClienteServidor();
  const { data: rival, error } = await supabase.from("rival").select().eq("id", id).maybeSingle();
  if (error) throw error;
  if (!rival) notFound();

  const { count: partidos } = await supabase.from("partido").select("id", { count: "exact", head: true }).eq("rival_id", id);
  const url = urlEscudo(supabase, rival.escudo_path);

  return (
    <main>
      <h1>{rival.nombre}</h1>
      <p>
        {rival.activo ? "Activo" : "Dado de baja (no se ofrece para Partidos nuevos)"} · {partidos ?? 0} Partido(s)
      </p>
      {aviso === "escudo" && <p role="alert">El Rival se dio de alta, pero no se pudo subir el escudo. Probá de nuevo.</p>}
      {aviso === "borrar" && <p role="alert">No se pudo borrar el Rival: tiene Partidos. Dalo de baja.</p>}

      <h2>Datos</h2>
      <FormularioRival id={rival.id} nombre={rival.nombre} clubId={esClubId(rival.club_id) ? rival.club_id : null} />

      <h2>Escudo</h2>
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- UI mínima; la etapa de diseño decide */}
          <img src={url} alt={`Escudo de ${rival.nombre}`} width={96} />
          <form action={quitarEscudo.bind(null, rival.id)}>
            <button type="submit">Quitar escudo</button>
          </form>
        </>
      ) : (
        <p>Sin escudo.</p>
      )}
      <FormularioEscudo id={rival.id} />

      <h2>Baja</h2>
      <form action={cambiarActivoRival.bind(null, rival.id, !rival.activo)}>
        <button type="submit">{rival.activo ? "Dar de baja" : "Reactivar"}</button>
      </form>
      {!partidos && (
        <form action={borrarRival.bind(null, rival.id)}>
          <button type="submit">Borrar (no tiene Partidos)</button>
        </form>
      )}

      <p>
        <Link href="/admin/rivales">Volver a los Rivales</Link>
      </p>
    </main>
  );
}
