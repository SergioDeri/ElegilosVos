// Partidos de un Club (o de la Selección) con el estado de su Votación y sus
// horas, según el Calendario de Votación (@/domain/calendario, la misma regla
// que `votacion_de_partido` en SQL).
import Link from "next/link";
import { notFound } from "next/navigation";
import { calcularVotaciones } from "@/domain/calendario";
import { formatearHoraUy } from "@/domain/comun/horario";
import { ventanaVacia } from "@/domain/partidos";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esClubOSeleccion, SELECCION } from "@/domain/comun/tipos";
import { deClubOSeleccion } from "../../../_comun/etiquetas";
import { cargarConOnceElegido, cargarPartidosDelClub } from "../../_partidos/datos";
import { ETIQUETA_VOTACION } from "../../_partidos/textos";

function horaActual(): Date {
  return new Date();
}

export default async function PaginaPartidos({ params }: PageProps<"/admin/partidos/[club]">) {
  await requerirAdmin();
  const { club } = await params;
  if (!esClubOSeleccion(club)) notFound();

  const supabase = await crearClienteServidor();
  const [partidos, conOnceElegido] = await Promise.all([cargarPartidosDelClub(supabase, club), cargarConOnceElegido(supabase, club)]);
  const porId = new Map(partidos.map((p) => [p.id, p]));
  const ahora = horaActual();
  const votaciones = calcularVotaciones(partidos, ahora, club);

  return (
    <main>
      <h1>Partidos {deClubOSeleccion(club)}</h1>
      <p>
        <Link href={`/admin/partidos/${club}/nuevo`}>Cargar un Partido</Link> · Horas de Uruguay.{" "}
        {club === SELECCION
          ? "La Votación abre 14 días antes del inicio (o al cargarlo, si es después) y cierra 1 hora antes del inicio; puede haber dos abiertas a la vez."
          : "La Votación abre cuando termina el Partido anterior (o al cargarlo) y cierra 1 hora antes del inicio."}
      </p>
      {votaciones.length === 0 ? (
        <p>No hay Partidos cargados.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Inicio</th>
              <th>Rival</th>
              <th>Partido</th>
              <th>Votación</th>
              <th>Abre</th>
              <th>Cierra</th>
            </tr>
          </thead>
          <tbody>
            {votaciones.map((v) => {
              const p = porId.get(v.partidoId)!;
              // Con resultado congelado la Votación ya cerró, aunque el Partido se haya postergado o cancelado después.
              const congelado = conOnceElegido.has(p.id);
              const nuncaAbre = !congelado && v.estado !== "anulada" && ventanaVacia(v);
              const sinHoras = congelado || v.estado === "anulada";
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/partidos/${club}/${p.id}`}>{formatearHoraUy(p.inicio)}</Link>
                  </td>
                  <td>{p.rivalNombre}</td>
                  <td>{p.estado === "cancelado" ? "Cancelado" : "Programado"}</td>
                  <td>
                    {congelado ? "Cerrada (resultado congelado)" : ETIQUETA_VOTACION[v.estado]}
                    {nuncaAbre && <strong> (nunca abre)</strong>}
                  </td>
                  <td>{sinHoras ? "—" : formatearHoraUy(v.abre)}</td>
                  <td>{sinHoras ? "—" : formatearHoraUy(v.cierra)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p>
        <Link href="/admin">Volver al backoffice</Link>
      </p>
    </main>
  );
}
