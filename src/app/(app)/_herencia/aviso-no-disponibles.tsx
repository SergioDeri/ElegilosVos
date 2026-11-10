// Aviso de no disponibles (ticket 10): Jugadores de la Alineación guardada que
// dejaron de estar Disponibles o salieron del Plantel, con el motivo, para que
// el Hincha los reemplace. Se calcula en el servidor al cargar la pantalla.
import type { Alineacion } from "@/domain/editor";
import { esquema } from "@/domain/esquemas";
import { jugadoresNoDisponibles, type MotivoNoDisponible } from "@/domain/herencia";
import type { JugadorDelClub } from "@/lib/club/lecturas";
import { NOMBRE_DISPONIBILIDAD } from "@/domain/comun/textos";

const MOTIVO: Record<MotivoNoDisponible, string> = {
  lesionado: NOMBRE_DISPONIBILIDAD.lesionado,
  suspendido: NOMBRE_DISPONIBILIDAD.suspendido,
  no_disponible: NOMBRE_DISPONIBILIDAD.no_disponible,
  fuera_del_plantel: "Salió del Plantel",
};

export function AvisoNoDisponibles({ alineacion, jugadores }: { alineacion: Alineacion; jugadores: JugadorDelClub[] }) {
  const avisos = jugadoresNoDisponibles(alineacion, jugadores);
  if (avisos.length === 0) return null;
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const etiqueta = new Map(esquema(alineacion.esquema).puestos.map((p) => [p.id, p.etiqueta]));

  return (
    <section role="alert" aria-label="Jugadores no disponibles en tu Alineación">
      <p>
        {avisos.length === 1
          ? "Un Jugador de tu Alineación ya no está Disponible y no va a contar en tu voto. Reemplazalo si querés:"
          : "Algunos Jugadores de tu Alineación ya no están Disponibles y no van a contar en tu voto. Reemplazalos si querés:"}
      </p>
      <ul>
        {avisos.map((a) => {
          const jugador = porId.get(a.jugadorId);
          const detalle = a.motivo !== "fuera_del_plantel" && jugador?.motivo ? `: ${jugador.motivo}` : "";
          return (
            <li key={a.puesto}>
              {jugador ? (jugador.numero === null ? jugador.nombre : `${jugador.numero} ${jugador.nombre}`) : "Jugador"} ({etiqueta.get(a.puesto)}) — {MOTIVO[a.motivo]}
              {detalle}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
