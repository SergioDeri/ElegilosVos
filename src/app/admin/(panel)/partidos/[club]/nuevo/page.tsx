// Alta de un Partido del Club: Rival activo (no el propio Club) e inicio en
// hora de Uruguay.
import Link from "next/link";
import { notFound } from "next/navigation";
import { rivalesParaPartido } from "@/domain/partidos";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { esClubId } from "@/domain/comun/tipos";
import { cargarRivales } from "../../../_partidos/datos";
import { FormularioAltaPartido } from "../../../_partidos/formularios";

export default async function PaginaNuevoPartido({ params }: PageProps<"/admin/partidos/[club]/nuevo">) {
  await requerirAdmin();
  const { club } = await params;
  if (!esClubId(club)) notFound();

  const supabase = await crearClienteServidor();
  const rivales = rivalesParaPartido(await cargarRivales(supabase), club).map(({ id, nombre }) => ({ id, nombre }));

  return (
    <main>
      <h1>Cargar un Partido de {NOMBRE_CLUB[club]}</h1>
      <FormularioAltaPartido club={club} rivales={rivales} />
      <p>
        <Link href="/admin/rivales">¿Falta el Rival? Cargalo en el catálogo</Link> ·{" "}
        <Link href={`/admin/partidos/${club}`}>Volver a los Partidos</Link>
      </p>
    </main>
  );
}
