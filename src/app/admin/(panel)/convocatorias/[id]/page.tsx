// Corrección de una Convocatoria (por ejemplo, si el DT reemplaza a alguien).
import Link from "next/link";
import { notFound } from "next/navigation";
import { esUuid } from "@/domain/comun/ids";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarDatosDeConvocatorias } from "../datos";
import { BotonBorrarConvocatoria, FormularioConvocatoria } from "../formulario";

export default async function PaginaConvocatoria({ params }: PageProps<"/admin/convocatorias/[id]">) {
  await requerirAdmin();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await crearClienteServidor();
  const { elegibles, partidos, convocatorias } = await cargarDatosDeConvocatorias(supabase);
  const convocatoria = convocatorias.find((c) => c.id === id);
  if (!convocatoria) notFound();

  return (
    <main>
      <h1>Corregir la Convocatoria</h1>
      <p>
        Mientras la Votación de sus Partidos sigue abierta, el Parcial muestra el Gran Ausente provisorio con esta
        Convocatoria.
      </p>
      <FormularioConvocatoria
        id={convocatoria.id}
        elegibles={elegibles}
        partidos={partidos}
        convocados={convocatoria.jugadores}
        aplicaA={convocatoria.partidos}
      />
      <BotonBorrarConvocatoria id={convocatoria.id} />
      <p>
        <Link href="/admin/convocatorias">Volver a las Convocatorias</Link>
      </p>
    </main>
  );
}
