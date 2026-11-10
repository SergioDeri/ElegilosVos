// Convocatorias de la Selección en el backoffice (Selección, ticket 09): cada
// una con sus Partidos y cuántos convocados tiene. Con Convocatoria, el
// Parcial de sus Partidos muestra el Gran Ausente provisorio.
import Link from "next/link";
import { formatearHoraUy } from "@/domain/comun/horario";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarDatosDeConvocatorias } from "./datos";

export default async function PaginaConvocatorias() {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { partidos, convocatorias } = await cargarDatosDeConvocatorias(supabase);
  const porId = new Map(partidos.map((p) => [p.id, p]));

  return (
    <main>
      <h1>Convocatorias de la Selección</h1>
      <p>
        La lista de Jugadores que el DT llama para uno o más Partidos (por ejemplo, los dos de una fecha doble). Cada Partido
        tiene a lo sumo una. No cambia lo que se puede votar: en el Parcial, el Más Pedido pasa a ser el Gran Ausente.
      </p>
      <p>
        <Link href="/admin/convocatorias/nueva">Cargar una Convocatoria</Link>
      </p>
      {convocatorias.length === 0 ? (
        <p>No hay Convocatorias cargadas.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Partidos</th>
              <th>Convocados</th>
              <th>Última corrección</th>
            </tr>
          </thead>
          <tbody>
            {convocatorias.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/convocatorias/${c.id}`}>
                    {c.partidos.length === 0
                      ? "Sin Partidos"
                      : c.partidos
                          .map((id) => porId.get(id))
                          .filter((p) => p !== undefined)
                          .sort((a, b) => a.inicio.localeCompare(b.inicio))
                          .map((p) => `vs ${p.rivalNombre} (${formatearHoraUy(new Date(p.inicio))})`)
                          .join(" · ")}
                  </Link>
                </td>
                <td>{c.jugadores.length}</td>
                <td>{formatearHoraUy(new Date(c.actualizadoEn))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>
        <Link href="/admin">Volver al backoffice</Link>
      </p>
    </main>
  );
}
