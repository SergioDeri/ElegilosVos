// Tarjeta del Partido en pantalla (ticket 09): escudos, rival, fecha y el
// estado de la Votación con su cuenta regresiva. La usan el inicio y el armado.
import Link from "next/link";
import { finDePartido } from "@/domain/calendario";
import { formatearHoraUy } from "@/domain/comun/horario";
import { urlEscudo } from "@/lib/imagenes/subida";
import type { PartidoDelClub } from "@/lib/club/lecturas";
import { Escudo } from "@/app/_pixel/escudo";
import { Icono } from "@/app/_pixel/icono";
import { CuentaRegresiva } from "../_alineacion/cuenta-regresiva";
import { SELECCION } from "@/domain/comun/tipos";
import type { PantallaDePartido } from "./pantalla";
import estilos from "./partido.module.css";

type EnPantalla = PantallaDePartido;

export function TarjetaPartido(props: {
  pantalla: EnPantalla;
  partido: PartidoDelClub;
  votacion: NonNullable<EnPantalla["votacion"]>;
}) {
  const { pantalla, partido, votacion } = props;
  const rival = partido.rival?.nombre ?? "Rival a confirmar";
  return (
    <section className={estilos.partido} aria-label="Próximo Partido">
      <div className={estilos.rival}>
        <div className={estilos.escudos}>
          <Escudo nombre={pantalla.club} url={urlEscudo(pantalla.supabase, pantalla.escudoDelClub)} />
          <Escudo nombre={rival} url={urlEscudo(pantalla.supabase, partido.rival?.escudoPath ?? null)} />
        </div>
        <div>
          <h2 className={estilos.titulo}>
            {pantalla.club} vs {rival}
          </h2>
          <p className={estilos.fecha}>
            <time dateTime={partido.inicio.toISOString()}>{formatearHoraUy(partido.inicio)}</time> (hora de Uruguay)
          </p>
        </div>
      </div>
      <MensajeVotacion
        partidoId={partido.id}
        conOnceElegido={pantalla.conOnceElegido.has(partido.id)}
        estado={votacion.estado}
        abre={votacion.abre}
        cierra={votacion.cierra}
        finDelPartido={finDePartido(partido.inicio)}
        seleccion={pantalla.de === SELECCION}
      />
    </section>
  );
}

function MensajeVotacion(props: {
  partidoId: string;
  conOnceElegido: boolean;
  estado: string;
  abre: Date;
  cierra: Date;
  finDelPartido: Date;
  /** En la Selección la Votación siguiente no abre al terminar este Partido (abre 14 días antes del suyo). */
  seleccion: boolean;
}) {
  const siguiente = props.seleccion
    ? ""
    : ` La del próximo Partido abre cuando termine este (${formatearHoraUy(props.finDelPartido)}).`;
  // La Votación ya cerró y su resultado quedó congelado, pero el Partido se
  // postergó o se canceló después: el Calendario ya no refleja ese cierre.
  if (props.conOnceElegido) {
    const enlace = <Link href={`/resultados/${props.partidoId}`}>Ver el 11 Elegido</Link>;
    return props.estado === "anulada" ? (
      <p role="status">
        Este Partido se canceló después del cierre de su Votación: el 11 Elegido quedó igual. {enlace}.
      </p>
    ) : (
      <p role="status">
        La Votación de este Partido ya cerró y el 11 Elegido quedó congelado: aunque el Partido cambió de fecha, no se
        reabre. {enlace}.{siguiente}
      </p>
    );
  }
  switch (props.estado) {
    case "abierta":
      return (
        <p className={estilos.votacion}>
          <Icono nombre="cierre" />
          La Votación cierra en <CuentaRegresiva hasta={props.cierra.toISOString()} /> ({formatearHoraUy(props.cierra)}).
          Tu Alineación se guarda sola: la que tengas al cierre es tu voto.
        </p>
      );
    case "pendiente":
      return (
        <p role="status">
          La Votación todavía no abrió. Abre el {formatearHoraUy(props.abre)} (en{" "}
          <CuentaRegresiva hasta={props.abre.toISOString()} />
          ).
        </p>
      );
    case "cerrada":
      return (
        <p role="status">
          <Icono nombre="cierre" />
          La Votación de este Partido cerró el {formatearHoraUy(props.cierra)}. Tu Alineación ya no se puede cambiar.
          {siguiente}
        </p>
      );
    case "anulada":
      return <p role="status">Este Partido se canceló: su Votación quedó anulada y no va a tener 11 Elegido.</p>;
    default:
      return null;
  }
}
