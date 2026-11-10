// Corrección de una Convocatoria (por ejemplo, si el DT reemplaza a alguien).
import Link from "next/link";
import { notFound } from "next/navigation";
import { esUuid } from "@/domain/comun/ids";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarDatosDeConvocatorias, partidosFijos } from "../datos";
import { BotonBorrarConvocatoria, FormularioConvocatoria } from "../formulario";

export default async function PaginaConvocatoria({ params }: PageProps<"/admin/convocatorias/[id]">) {
  await requerirAdmin();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await crearClienteServidor();
  const { elegibles, partidos, convocatorias } = await cargarDatosDeConvocatorias(supabase);
  const convocatoria = convocatorias.find((c) => c.id === id);
  if (!convocatoria) notFound();
  const fijos = await partidosFijos(supabase, convocatoria.partidos);
  const fija = fijos.size > 0;
  // En una fecha doble, los Partidos que siguen abiertos se pueden separar en una Convocatoria corregida.
  const separables = partidos.filter(
    (p) => convocatoria.partidos.includes(p.id) && !fijos.has(p.id) && p.votacion !== "cerrada" && !p.cancelado,
  );

  return (
    <main>
      <h1>{fija ? "Convocatoria" : "Corregir la Convocatoria"}</h1>
      {fija ? (
        <>
          <p role="status">
            Ya se publicó el Gran Ausente final de un Partido de esta Convocatoria: quedó fija y no se puede corregir ni
            borrar.
          </p>
          <ul>
            {elegibles
              .filter((j) => convocatoria.jugadores.includes(j.id))
              .map((j) => (
                <li key={j.id}>{j.nombre}</li>
              ))}
          </ul>
          {separables.length > 0 && (
            <section aria-labelledby="corregir-abiertos">
              <h2 id="corregir-abiertos">Corregir para los Partidos que siguen abiertos</h2>
              <p>
                Si el DT cambió la lista para un Partido cuya Votación sigue abierta, guardala como una Convocatoria nueva
                para ese Partido. La de los Partidos cerrados no cambia.
              </p>
              <FormularioConvocatoria
                id={null}
                elegibles={elegibles}
                partidos={partidos.map((p) =>
                  separables.some((s) => s.id === p.id) ? { ...p, convocatoriaId: null } : p,
                )}
                convocados={convocatoria.jugadores}
                aplicaA={separables.map((p) => p.id)}
              />
            </section>
          )}
        </>
      ) : (
        <>
          <p>
            Mientras la Votación de sus Partidos sigue abierta, el Parcial muestra el Gran Ausente provisorio con esta
            Convocatoria. Cuando se publica el Gran Ausente final (al cierre, o al cargarla si la Votación ya cerró),
            queda fija.
          </p>
          <FormularioConvocatoria
            id={convocatoria.id}
            elegibles={elegibles}
            partidos={partidos}
            convocados={convocatoria.jugadores}
            aplicaA={convocatoria.partidos}
          />
          <BotonBorrarConvocatoria id={convocatoria.id} />
        </>
      )}
      <p>
        <Link href="/admin/convocatorias">Volver a las Convocatorias</Link>
      </p>
    </main>
  );
}
