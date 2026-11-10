// Mis formaciones: el histórico de las Alineaciones que armó el Hincha, una
// por Partido de su Club. La de la Votación en curso lleva al armado; las
// demás, a su detalle en la cancha.
import Link from "next/link";
import { cierreDeVotacion } from "@/domain/calendario";
import { formatearHoraUy } from "@/domain/comun/horario";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { requerirHincha } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarMisFormaciones } from "./datos";

export default async function PaginaMisFormaciones() {
  const hincha = await requerirHincha();
  const club = NOMBRE_CLUB[hincha.clubFavorito];
  const supabase = await crearClienteServidor();
  const formaciones = await cargarMisFormaciones(supabase, hincha.id, hincha.clubFavorito);
  const ahora = new Date();

  return (
    <main>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
      <h1>Mis formaciones</h1>
      {formaciones.length === 0 ? (
        <p role="status">
          Todavía no armaste ninguna Alineación. <Link href="/mi-alineacion">Armá tu 11</Link>.
        </p>
      ) : (
        <ul>
          {formaciones.map((f) => {
            const enCurso = !f.cancelado && cierreDeVotacion(f.inicio).getTime() > ahora.getTime();
            return (
              <li key={f.partidoId}>
                <h2>
                  {club} vs {f.rival}
                </h2>
                <p>
                  <time dateTime={f.inicio.toISOString()}>{formatearHoraUy(f.inicio)}</time> · {f.alineacion.esquema} ·{" "}
                  {Object.keys(f.alineacion.puestos).length} de 11 Jugadores
                  {f.cancelado && " · Partido cancelado"}
                </p>
                <p>
                  {enCurso ? (
                    <Link href="/mi-alineacion">Votación en curso: editar mi alineación</Link>
                  ) : (
                    <Link href={`/mis-formaciones/${f.partidoId}`}>Ver mi formación</Link>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
