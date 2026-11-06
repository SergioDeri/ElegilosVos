import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/admin";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { esClubId } from "@/domain/comun/tipos";
import { FormularioAlta } from "../../../_componentes/formularios";

export default async function PaginaAltaJugador({ params }: PageProps<"/admin/planteles/[club]/nuevo">) {
  await requerirAdmin();
  const { club } = await params;
  if (!esClubId(club)) notFound();

  return (
    <main>
      <h1>Alta de Jugador en el Plantel de {NOMBRE_CLUB[club]}</h1>
      <FormularioAlta club={club} />
      <p>
        <Link href={`/admin/planteles/${club}`}>Volver al Plantel</Link>
      </p>
    </main>
  );
}
