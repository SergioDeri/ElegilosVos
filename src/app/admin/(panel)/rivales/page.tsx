// Catálogo de Rivales: activos y dados de baja, y alta de uno nuevo.
import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { cargarRivales, urlEscudo, type RivalVista } from "../_partidos/datos";
import { FormularioAltaRival } from "../_partidos/formularios";
import { Escudo } from "@/app/_pixel/escudo";

export default async function PaginaRivales() {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const rivales = await cargarRivales(supabase);
  const activos = rivales.filter((r) => r.activo);
  const deBaja = rivales.filter((r) => !r.activo);

  const tabla = (lista: RivalVista[]) => (
    <table>
      <thead>
        <tr>
          <th>Escudo</th>
          <th>Nombre</th>
          <th>Club</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((r) => {
          const url = urlEscudo(supabase, r.escudoPath);
          return (
            <tr key={r.id}>
              <td>
                <Escudo nombre={r.nombre} url={url} />
              </td>
              <td>
                <Link href={`/admin/rivales/${r.id}`}>{r.nombre}</Link>
              </td>
              <td>{r.clubId ? NOMBRE_CLUB[r.clubId] : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <main>
      <h1>Rivales</h1>
      <p>
        El Clásico se carga como un Partido para cada Club, con el otro Club como Rival: marcá en el catálogo qué Rival es
        Peñarol y cuál Nacional.
      </p>
      <h2>Activos ({activos.length})</h2>
      {activos.length > 0 ? tabla(activos) : <p>No hay Rivales activos.</p>}
      {deBaja.length > 0 && (
        <>
          <h2>Dados de baja ({deBaja.length})</h2>
          <p>No se ofrecen para Partidos nuevos.</p>
          {tabla(deBaja)}
        </>
      )}
      <h2>Dar de alta un Rival</h2>
      <FormularioAltaRival />
      <p>
        <Link href="/admin">Volver al backoffice</Link>
      </p>
    </main>
  );
}
