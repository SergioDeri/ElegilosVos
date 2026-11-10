import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/admin";
import { esClubOSeleccion } from "@/domain/comun/tipos";
import { deClubOSeleccion } from "../../../../_comun/etiquetas";
import { FormularioAlta } from "../../../_componentes/formularios";

export default async function PaginaAltaJugador({ params }: PageProps<"/admin/planteles/[club]/nuevo">) {
  await requerirAdmin();
  const { club } = await params;
  if (!esClubOSeleccion(club)) notFound();

  return (
    <main>
      <h1>Alta de Jugador en el Plantel {deClubOSeleccion(club)}</h1>
      <FormularioAlta club={club} />
      <p>
        <Link href={`/admin/planteles/${club}`}>Volver al Plantel</Link>
      </p>
    </main>
  );
}
