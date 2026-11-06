// Vista de un resultado de Votación: 11 Elegido en la cancha, votos y la
// Coincidencia del Hincha, o el motivo por el que no hay 11 Elegido.
import Link from "next/link";
import { BotonCompartir } from "@/app/_compartir/boton-compartir";
import { coincidencia, type EstadoResultado } from "@/domain/cierre";
import { formatearHoraUy } from "@/domain/comun/horario";
import { esquema } from "@/domain/esquemas";
import type { ItemHistorial, JugadorResultado, PartidoResultado, ResultadoVista } from "./datos";
import { CLASE_PUESTO, CLASE_SIGLA, Cancha, posicionPuesto } from "@/app/_cancha/cancha";
import estilos from "./resultados.module.css";

export const MOTIVO_SIN_ONCE: Record<Exclude<EstadoResultado, "con_once">, string> = {
  sin_alineaciones: "Nadie tenía una Alineación que cuente al cierre de la Votación, así que no hubo 11 Elegido.",
  anulada: "El Partido se canceló: su Votación quedó anulada y no tuvo 11 Elegido.",
  nunca_abrio:
    "La Votación de este Partido no llegó a abrir (se programó sin tiempo para votar), así que no hubo 11 Elegido.",
};

export const ETIQUETA_ESTADO: Record<EstadoResultado, string> = {
  con_once: "11 Elegido",
  sin_alineaciones: "Sin Alineaciones",
  anulada: "Anulada",
  nunca_abrio: "No abrió",
};

export function EncabezadoPartido({ club, partido }: { club: string; partido: PartidoResultado }) {
  return (
    <h2>
      {club} vs {partido.rival}{" "}
      <small>
        <time dateTime={partido.inicio.toISOString()}>{formatearHoraUy(partido.inicio)}</time>
        {partido.cancelado && " · Partido cancelado"}
      </small>
    </h2>
  );
}

export function VistaResultado(props: {
  partido: PartidoResultado;
  resultado: ResultadoVista | null;
  jugadores: Map<string, JugadorResultado>;
  misJugadores: string[] | null;
  /** 11 Real (ticket 14): ids, o null/ausente si no está cargado. */
  onceReal?: string[] | null;
}) {
  const { resultado, jugadores, misJugadores, onceReal } = props;

  if (!resultado) {
    return (
      <p role="status">
        La Votación de este Partido ya cerró y el 11 Elegido se está calculando. Volvé a entrar en unos minutos.
      </p>
    );
  }

  if (resultado.estado !== "con_once" || !resultado.esquema) {
    return <p role="status">{MOTIVO_SIN_ONCE[resultado.estado as Exclude<EstadoResultado, "con_once">]}</p>;
  }

  const definicion = esquema(resultado.esquema);
  const porPuesto = new Map(resultado.once.map((a) => [a.puesto, a]));
  const nombre = (id: string | null) => {
    const j = id ? jugadores.get(id) : undefined;
    return j ? `${j.numero}. ${j.nombre}` : "Vacante";
  };
  const enComun = misJugadores ? coincidencia(misJugadores, resultado.once.map((a) => a.jugadorId)) : null;

  return (
    <>
      <p>
        Esquema: <strong>{definicion.nombre}</strong>. Lo eligieron {resultado.alineacionesQueCuentan}{" "}
        {resultado.alineacionesQueCuentan === 1 ? "Alineación" : "Alineaciones"}. Calculado el{" "}
        {formatearHoraUy(resultado.calculadoEn)}.
      </p>
      <p role="status">
        {enComun === null
          ? "No armaste una Alineación para este Partido."
          : `Coincidiste en ${enComun} de 11 con el 11 Elegido.`}
      </p>
      <Cancha className={estilos.cancha} aria-label={`11 Elegido en ${definicion.nombre}`}>
        {definicion.puestos.map((p) => {
          const a = porPuesto.get(p.id);
          const mio = !!(a?.jugadorId && misJugadores?.includes(a.jugadorId));
          return (
            <div
              key={p.id}
              className={`${CLASE_PUESTO} ${estilos.puesto}`}
              data-mio={mio}
              style={posicionPuesto(p)}
            >
              <span className={CLASE_SIGLA}>{p.sigla}</span>
              <span>{nombre(a?.jugadorId ?? null)}</span>
            </div>
          );
        })}
      </Cancha>
      <BotonCompartir
        urlImagen={`/api/imagen/once-elegido/${props.partido.id}`}
        enlace={`/compartir/once-elegido/${props.partido.id}`}
        titulo="El 11 Elegido por la hinchada"
      />
      <table>
        <thead>
          <tr>
            <th>Puesto</th>
            <th>Jugador</th>
            <th>Votos</th>
          </tr>
        </thead>
        <tbody>
          {definicion.puestos.map((p) => {
            const a = porPuesto.get(p.id);
            return (
              <tr key={p.id}>
                <td>{p.etiqueta}</td>
                <td>
                  {nombre(a?.jugadorId ?? null)}
                  {a?.jugadorId && misJugadores?.includes(a.jugadorId) ? " (en tu Alineación)" : ""}
                </td>
                <td>{a?.origen === "vacante" ? "Sin votos válidos (completado)" : (a?.votos ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {onceReal && <OnceReal onceReal={onceReal} once={resultado.once} nombre={nombre} />}
    </>
  );
}

/** Coincidencia entre el 11 Elegido y el 11 Real, y los 11 titulares (ticket 14). */
function OnceReal(props: {
  onceReal: string[];
  once: ResultadoVista["once"];
  nombre: (id: string | null) => string;
}) {
  const elegidos = props.once.map((a) => a.jugadorId);
  return (
    <section aria-label="11 Real">
      <h3>11 Real</h3>
      <p role="status">La hinchada acertó {coincidencia(elegidos, props.onceReal)} de 11.</p>
      <ul>
        {props.onceReal.map((id) => (
          <li key={id}>
            {props.nombre(id)}
            {elegidos.includes(id) ? " (en el 11 Elegido)" : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Historial(props: {
  club: string;
  items: ItemHistorial[];
  actual?: string;
}) {
  if (props.items.length === 0) return <p>Todavía no hay resultados de {props.club}.</p>;
  return (
    <ul>
      {props.items.map(({ partido, estado, aciertoOnceReal }) => (
        <li key={partido.id}>
          {partido.id === props.actual ? (
            <strong>
              vs {partido.rival}, {formatearHoraUy(partido.inicio)}
            </strong>
          ) : (
            <Link href={`/resultados/${partido.id}`}>
              vs {partido.rival}, {formatearHoraUy(partido.inicio)}
            </Link>
          )}{" "}
          {partido.cancelado && estado !== "anulada" && " (Partido cancelado después del cierre)"} — {ETIQUETA_ESTADO[estado]}
          {aciertoOnceReal !== null && ` · la hinchada acertó ${aciertoOnceReal} de 11 del 11 Real`}
        </li>
      ))}
    </ul>
  );
}
