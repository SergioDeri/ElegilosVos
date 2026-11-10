// Alta de una Convocatoria: elegibles del Plantel de la Selección y Partidos
// de la Selección a los que se aplica.
import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarDatosDeConvocatorias } from "../datos";
import { FormularioConvocatoria } from "../formulario";

export default async function PaginaNuevaConvocatoria() {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { elegibles, partidos } = await cargarDatosDeConvocatorias(supabase);

  return (
    <main>
      <h1>Cargar una Convocatoria</h1>
      <FormularioConvocatoria id={null} elegibles={elegibles} partidos={partidos} convocados={[]} aplicaA={[]} />
      <p>
        <Link href="/admin/convocatorias">Volver a las Convocatorias</Link>
      </p>
    </main>
  );
}
