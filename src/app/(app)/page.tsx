// Pantalla principal del Hincha (ticket 09): el próximo Partido de su Club, la
// cuenta regresiva al cierre y el armado de su Alineación. Sin Votación
// abierta, la cancha queda en solo lectura con el motivo.
import { votacionEnPantalla } from "@/domain/armado";
import { finDePartido } from "@/domain/calendario";
import { formatearHoraUy } from "@/domain/comun/horario";
import { aJson } from "@/domain/editor";
import { requerirHincha } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlEscudo } from "@/lib/imagenes/subida";
import { cargarAlineacion, cargarConOnceElegido } from "./_alineacion/datos";
import { leerPartidos, leerPlantel } from "@/lib/club/lecturas";
import { CuentaRegresiva } from "./_alineacion/cuenta-regresiva";
import { EditorAlineacion } from "./_alineacion/editor-alineacion";
import { EnlaceParcial } from "./parcial/enlace-parcial";
import inicio from "./inicio.module.css";
import { Icono } from "@/app/_pixel/icono";
import { asegurarHerencia } from "@/lib/herencia/asegurar";
import { AvisoNoDisponibles } from "./_herencia/aviso-no-disponibles";
import Link from "next/link";
import { BotonCompartir } from "@/app/_compartir/boton-compartir";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { Escudo } from "@/app/_pixel/escudo";

function horaActual(): Date {
  return new Date();
}

export default async function Inicio() {
  const hincha = await requerirHincha();
  const club = NOMBRE_CLUB[hincha.clubFavorito];
  const supabase = await crearClienteServidor();
  const [partidos, jugadores] = await Promise.all([
    leerPartidos(supabase, hincha.clubFavorito),
    leerPlantel(supabase, hincha.clubFavorito),
  ]);
  const ahora = horaActual();
  // Solo los Partidos que no terminaron pueden ir a la pantalla.
  const conOnceElegido = await cargarConOnceElegido(
    supabase,
    partidos.filter((p) => finDePartido(p.inicio).getTime() > ahora.getTime()).map((p) => p.id),
  );
  const votacion = votacionEnPantalla(partidos, ahora, conOnceElegido);

  if (!votacion) {
    return (
      <main>
        <h1>Elegilos Vos</h1>
        <Link href="/resultados">Ver el 11 Elegido y el historial</Link>
        <p>Sos hincha de {club}.</p>
        <p role="status">Todavía no hay un próximo Partido de {club} cargado. Cuando se cargue, vas a poder armar tu 11.</p>
      </main>
    );
  }

  const partido = partidos.find((p) => p.id === votacion.partidoId)!;
  if (votacion.estado === "abierta") await asegurarHerencia(hincha.id, hincha.clubFavorito, ahora);
  const alineacion = await cargarAlineacion(supabase, partido.id);
  const rival = partido.rival?.nombre ?? "Rival a confirmar";

  return (
    <main>
      <h1>Elegilos Vos</h1>
      <Link href="/resultados">Ver el 11 Elegido y el historial</Link>
      <section className={inicio.partido} aria-label="Próximo Partido">
        <div className={inicio.rival}>
          <Escudo nombre={rival} url={urlEscudo(supabase, partido.rival?.escudoPath ?? null)} />
          <div>
            <h2 className={inicio.titulo}>
              {club} vs {rival}
            </h2>
            <p className={inicio.fecha}>
              <time dateTime={partido.inicio.toISOString()}>{formatearHoraUy(partido.inicio)}</time> (hora de Uruguay)
            </p>
          </div>
        </div>
        <MensajeVotacion
          partidoId={partido.id}
          conOnceElegido={conOnceElegido.has(partido.id)}
          estado={votacion.estado}
          abre={votacion.abre}
          cierra={votacion.cierra}
          finDelPartido={finDePartido(partido.inicio)}
        />
      </section>
      {votacion.estado === "abierta" && <EnlaceParcial />}

      {votacion.estado === "abierta" && alineacion && <AvisoNoDisponibles alineacion={alineacion} jugadores={jugadores} />}
      {votacion.estado !== "anulada" && (
        <EditorAlineacion
          // Al cambiar de Partido o de estado (por ejemplo, al cerrar), el editor arranca de nuevo.
          key={`${partido.id}:${votacion.estado}`}
          partidoId={partido.id}
          club={hincha.clubFavorito}
          inicial={alineacion ? aJson(alineacion) : null}
          jugadores={jugadores}
          editable={votacion.estado === "abierta"}
        />
      )}
      {votacion.estado !== "anulada" && (
        <BotonCompartir
          urlImagen={`/api/imagen/mi-alineacion/${partido.id}`}
          titulo={`Mi 11 para ${club} vs ${rival}`}
          sinImagen="Todavía no armaste tu Alineación para este Partido."
        />
      )}
    </main>
  );
}

function MensajeVotacion(props: {
  partidoId: string;
  conOnceElegido: boolean;
  estado: string;
  abre: Date;
  cierra: Date;
  finDelPartido: Date;
}) {
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
        reabre. {enlace}. La del próximo Partido abre cuando termine este ({formatearHoraUy(props.finDelPartido)}).
      </p>
    );
  }
  switch (props.estado) {
    case "abierta":
      return (
        <p className={inicio.votacion}>
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
          La Votación de este Partido cerró el {formatearHoraUy(props.cierra)}. Tu Alineación ya no se puede cambiar. La
          del próximo Partido abre cuando termine este ({formatearHoraUy(props.finDelPartido)}).
        </p>
      );
    case "anulada":
      return <p role="status">Este Partido se canceló: su Votación quedó anulada y no va a tener 11 Elegido.</p>;
    default:
      return null;
  }
}

