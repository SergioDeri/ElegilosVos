// Backoffice: participación y Parcial de cada Votación (ticket 11).
//
// Lee con la service role (después de requerirAdmin): el conteo necesita todas
// las Alineaciones, y la lectura de Partidos del Admin la agrega el ticket 08.
// Solo se muestran agregados, igual que al Hincha.
import Link from "next/link";
import { calcularVotaciones, type EstadoVotacion, type Votacion } from "@/domain/calendario";
import { formatearHoraUy } from "@/domain/comun/horario";
import { CLUBES, type ClubId } from "@/domain/comun/tipos";
import type { JugadorParaMostrar } from "@/domain/parcial";
import { requerirAdmin } from "@/lib/auth/admin";
import { calcularParcialCacheado } from "@/lib/parcial";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { VistaParcial } from "../../../_parcial/vista-parcial";
import { NOMBRE_CLUB } from "@/domain/comun/textos";

/** Se listan los Partidos que empezaron hace menos de esto, y todos los futuros. */
const DIAS_HACIA_ATRAS = 30;

const ETIQUETA_ESTADO: Record<EstadoVotacion, string> = {
  pendiente: "Pendiente",
  abierta: "Abierta",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

function horaActual(): Date {
  return new Date();
}

export default async function PaginaVotaciones() {
  await requerirAdmin();
  const ahora = horaActual();
  return (
    <main>
      <p>
        <Link href="/admin">Volver al backoffice</Link>
      </p>
      <h1>Votaciones</h1>
      <p>
        Alineaciones que cuentan y Parcial de cada Votación (los datos pueden tener hasta un minuto de demora). Las
        Votaciones cerradas muestran el conteo con la Disponibilidad actual.
      </p>
      {CLUBES.map((club) => (
        <VotacionesDelClub key={club} club={club} ahora={ahora} />
      ))}
    </main>
  );
}

async function VotacionesDelClub({ club, ahora }: { club: ClubId; ahora: Date }) {
  const servicio = crearClienteAdmin();
  const [{ data: partidos, error }, { data: jugadores, error: errorJugadores }] = await Promise.all([
    servicio.from("partido").select("id, inicio, estado, creado_en, rival(nombre)").eq("club_id", club),
    servicio.from("jugador").select("id, nombre, numero").eq("club_id", club),
  ]);
  if (error) throw error;
  if (errorJugadores) throw errorJugadores;

  const votaciones = calcularVotaciones(
    partidos.map((p) => ({
      id: p.id,
      inicio: new Date(p.inicio),
      estado: p.estado,
      creadoEn: new Date(p.creado_en),
    })),
    ahora,
  );
  const desde = ahora.getTime() - DIAS_HACIA_ATRAS * 24 * 60 * 60 * 1000;
  const porId = new Map(partidos.map((p) => [p.id, p]));
  const visibles = votaciones
    .filter((v) => new Date(porId.get(v.partidoId)!.inicio).getTime() >= desde)
    .sort((a, b) => Date.parse(porId.get(a.partidoId)!.inicio) - Date.parse(porId.get(b.partidoId)!.inicio));

  return (
    <section aria-label={`Votaciones de ${NOMBRE_CLUB[club]}`}>
      <h2>{NOMBRE_CLUB[club]}</h2>
      {visibles.length === 0 ? (
        <p>No hay Partidos en los últimos {DIAS_HACIA_ATRAS} días ni futuros.</p>
      ) : (
        visibles.map((v) => {
          const partido = porId.get(v.partidoId)!;
          return (
            <TarjetaVotacion
              key={v.partidoId}
              titulo={`${NOMBRE_CLUB[club]} vs ${partido.rival?.nombre ?? "Rival a confirmar"} — ${formatearHoraUy(new Date(partido.inicio))}`}
              votacion={v}
              jugadores={jugadores}
            />
          );
        })
      )}
    </section>
  );
}

async function TarjetaVotacion(props: {
  titulo: string;
  votacion: Votacion;
  jugadores: readonly JugadorParaMostrar[];
}) {
  const v = props.votacion;
  const conConteo = v.estado === "abierta" || v.estado === "cerrada";
  const resultado = conConteo ? await calcularParcialCacheado(v.partidoId) : null;
  return (
    <article>
      <h3>{props.titulo}</h3>
      <p>
        Votación: <strong>{ETIQUETA_ESTADO[v.estado]}</strong> (abre {formatearHoraUy(v.abre)}, cierra{" "}
        {formatearHoraUy(v.cierra)}).
        {resultado && ` Alineaciones que cuentan: ${resultado.alineacionesQueCuentan}.`}
      </p>
      {resultado && (
        <details open={v.estado === "abierta"}>
          <summary>{v.estado === "abierta" ? "Parcial" : "Conteo"}</summary>
          <VistaParcial resultado={resultado} jugadores={props.jugadores} textoVacio="Sin Alineaciones que cuenten." />
        </details>
      )}
    </article>
  );
}
