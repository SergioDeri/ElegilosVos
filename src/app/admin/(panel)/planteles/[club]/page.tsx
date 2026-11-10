// Plantel de un Club o de la Selección en el backoffice: Jugadores en el
// Plantel y dados de baja. Los de la Selección (los elegibles) no llevan número.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { NOMBRE_DISPONIBILIDAD } from "@/domain/comun/textos";
import { esClubOSeleccion, SELECCION } from "@/domain/comun/tipos";
import { ordenarPlantel } from "@/domain/planteles";
import { deClubOSeleccion, ETIQUETA_POSICION } from "../../../_comun/etiquetas";

export default async function PaginaPlantel({ params }: PageProps<"/admin/planteles/[club]">) {
  await requerirAdmin();
  const { club } = await params;
  if (!esClubOSeleccion(club)) notFound();
  const conNumero = club !== SELECCION;

  const supabase = await crearClienteServidor();
  const { data: jugadores, error } = await supabase
    .from("jugador")
    .select("id, nombre, numero, posicion_natural, disponibilidad, motivo_disponibilidad, en_plantel")
    .eq("club_id", club);
  if (error) throw error;

  const ordenados = ordenarPlantel(jugadores.map((j) => ({ ...j, posicionNatural: j.posicion_natural })));
  const enPlantel = ordenados.filter((j) => j.en_plantel);
  const deBaja = ordenados.filter((j) => !j.en_plantel);

  const tabla = (lista: typeof ordenados) => (
    <table>
      <thead>
        <tr>
          {conNumero && <th>N.º</th>}
          <th>Nombre</th>
          <th>Posición</th>
          <th>Disponibilidad</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((j) => (
          <tr key={j.id}>
            {conNumero && <td>{j.numero}</td>}
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
      <h1>Plantel {deClubOSeleccion(club)}</h1>
      {!conNumero && (
        <p>
          Los elegibles de la Selección, convocados o no. No llevan número. Un Jugador de un Club se carga aparte acá, con su
          propia Disponibilidad.
        </p>
      )}
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
