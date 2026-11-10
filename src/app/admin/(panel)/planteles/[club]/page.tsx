// Plantel de un Club en el backoffice: Jugadores en el Plantel y dados de baja.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { NOMBRE_CLUB, NOMBRE_DISPONIBILIDAD } from "@/domain/comun/textos";
import { esClubId, numeroDeClubDeLaBase } from "@/domain/comun/tipos";
import { ETIQUETA_POSICION } from "../../../_comun/etiquetas";

const ORDEN_POSICION = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 } as const;

export default async function PaginaPlantel({ params }: PageProps<"/admin/planteles/[club]">) {
  await requerirAdmin();
  const { club } = await params;
  if (!esClubId(club)) notFound();

  const supabase = await crearClienteServidor();
  const { data: jugadores, error } = await supabase
    .from("jugador")
    .select("id, nombre, numero, posicion_natural, disponibilidad, motivo_disponibilidad, en_plantel")
    .eq("club_id", club)
    .order("numero");
  if (error) throw error;

  const ordenados = jugadores.map((j) => ({ ...j, numero: numeroDeClubDeLaBase(j.numero) })).sort(
    (a, b) => ORDEN_POSICION[a.posicion_natural] - ORDEN_POSICION[b.posicion_natural] || a.numero - b.numero,
  );
  const enPlantel = ordenados.filter((j) => j.en_plantel);
  const deBaja = ordenados.filter((j) => !j.en_plantel);

  const tabla = (lista: typeof ordenados) => (
    <table>
      <thead>
        <tr>
          <th>N.º</th>
          <th>Nombre</th>
          <th>Posición</th>
          <th>Disponibilidad</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((j) => (
          <tr key={j.id}>
            <td>{j.numero}</td>
            <td>
              <Link href={`/admin/jugadores/${j.id}`}>{j.nombre}</Link>
            </td>
            <td>{ETIQUETA_POSICION[j.posicion_natural]}</td>
            <td>
              {NOMBRE_DISPONIBILIDAD[j.disponibilidad]}
              {j.motivo_disponibilidad ? ` (${j.motivo_disponibilidad})` : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <main>
      <h1>Plantel de {NOMBRE_CLUB[club]}</h1>
      <p>
        <Link href={`/admin/planteles/${club}/nuevo`}>Dar de alta un Jugador</Link>
      </p>
      <h2>En el Plantel ({enPlantel.length})</h2>
      {enPlantel.length > 0 ? tabla(enPlantel) : <p>No hay Jugadores en el Plantel.</p>}
      {deBaja.length > 0 && (
        <>
          <h2>Dados de baja ({deBaja.length})</h2>
          <p>No forman parte del Plantel: no se pueden elegir en las Alineaciones.</p>
          {tabla(deBaja)}
        </>
      )}
    </main>
  );
}
