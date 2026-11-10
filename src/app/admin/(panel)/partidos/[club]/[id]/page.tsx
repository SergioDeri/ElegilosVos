// Ficha de un Partido: su Votación, postergar o cambiar horario, cancelar o
// reactivar, y borrar (solo sin Alineaciones).
import Link from "next/link";
import { notFound } from "next/navigation";
import { calcularVotaciones } from "@/domain/calendario";
import { aHoraUyLocal, formatearHoraUy } from "@/domain/comun/horario";
import { rivalesParaPartido, validarAccion, ventanaVacia, type SituacionPartido } from "@/domain/partidos";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { nombreDeClubOSeleccion } from "@/domain/comun/textos";
import { esClubOSeleccion } from "@/domain/comun/tipos";
import { cargarPartidosDelClub, cargarRivales } from "../../../_partidos/datos";
import {
  FormularioBorrarPartido,
  FormularioCancelar,
  FormularioReactivar,
  FormularioReprogramar,
} from "../../../_partidos/formularios";
import { ETIQUETA_VOTACION, NUNCA_ABRE, ONCE_CONGELADO, TEXTO_RECHAZO } from "../../../_partidos/textos";

function horaActual(): Date {
  return new Date();
}

export default async function PaginaPartido({ params }: PageProps<"/admin/partidos/[club]/[id]">) {
  await requerirAdmin();
  const { club, id } = await params;
  if (!esClubOSeleccion(club)) notFound();

  const supabase = await crearClienteServidor();
  const partidos = await cargarPartidosDelClub(supabase, club);
  const partido = partidos.find((p) => p.id === id);
  if (!partido) notFound();

  const ahora = horaActual();
  const votacion = calcularVotaciones(partidos, ahora, club).find((v) => v.partidoId === id)!;
  const [{ data: tieneAlineaciones }, { data: tieneResultado }, rivales] = await Promise.all([
    supabase.rpc("partido_tiene_alineaciones", { partido: id }),
    supabase.rpc("tiene_resultado", { partido: id }),
    cargarRivales(supabase),
  ]);
  const situacion: SituacionPartido = {
    estado: partido.estado,
    inicio: partido.inicio,
    tieneAlineaciones: tieneAlineaciones !== false,
    // Con resultado congelado (ticket 12) la Votación es definitiva y el
    // Partido no se borra. Ante la duda (error), se trata como definitiva: la
    // base igual rechaza el borrado.
    tieneOnceElegido: tieneResultado !== false,
  };
  const congelado = situacion.tieneOnceElegido;
  const opciones = rivalesParaPartido(rivales, club, partido.rivalId).map(({ id, nombre }) => ({ id, nombre }));
  const inicioLocal = aHoraUyLocal(partido.inicio);
  const cancelar = validarAccion(situacion, { tipo: "cancelar" }, ahora);
  const borrar = validarAccion(situacion, { tipo: "borrar" }, ahora);

  return (
    <main>
      <h1>
        {nombreDeClubOSeleccion(club)} vs {partido.rivalNombre}
      </h1>
      <p>
        Inicio: {formatearHoraUy(partido.inicio)} (hora de Uruguay) · {partido.estado === "cancelado" ? "Cancelado" : "Programado"}
      </p>

      <h2>Votación</h2>
      {congelado ? (
        <p>Cerrada, con resultado congelado. {ONCE_CONGELADO}</p>
      ) : (
        <>
          <p>
            {ETIQUETA_VOTACION[votacion.estado]}
            {votacion.estado !== "anulada" && (
              <>
                {" "}
                · abre {formatearHoraUy(votacion.abre)} · cierra {formatearHoraUy(votacion.cierra)}
              </>
            )}
          </p>
          {votacion.estado !== "anulada" && ventanaVacia(votacion) && <p role="alert">{NUNCA_ABRE}</p>}
        </>
      )}
      <p>{tieneAlineaciones ? "Hay Hinchas con Alineaciones guardadas." : "Todavía no hay Alineaciones guardadas."}</p>

      {partido.estado === "programado" ? (
        <>
          <h2>Postergar o cambiar el horario</h2>
          <p>
            {congelado ? ONCE_CONGELADO : "El cierre de la Votación se mueve con el inicio."} Las Alineaciones guardadas
            no se tocan.
          </p>
          <FormularioReprogramar id={id} rivales={opciones} rivalId={partido.rivalId} inicio={inicioLocal} />

          <h2>Cancelar</h2>
          {cancelar.ok ? (
            <>
              <p>
                {congelado
                  ? `${ONCE_CONGELADO} Se puede reactivar con otra fecha.`
                  : "La Votación queda anulada (no tendrá 11 Elegido). Se puede reactivar mientras la Votación no haya cerrado."}
              </p>
              <FormularioCancelar id={id} />
            </>
          ) : (
            <p>{TEXTO_RECHAZO[cancelar.motivo]}</p>
          )}
        </>
      ) : (
        <>
          <h2>Reactivar</h2>
          <p>
            Deshace la cancelación (por ejemplo, un Partido suspendido que se reprograma) conservando las Alineaciones.
            {congelado ? ONCE_CONGELADO : "Solo con un inicio cuya Votación todavía no haya cerrado."}
          </p>
          <FormularioReactivar id={id} inicio={inicioLocal} />
        </>
      )}

      <h2>11 Real</h2>
      <p>
        <Link href={`/admin/partidos/${club}/${id}/once-real`}>Cargar o corregir el 11 Real</Link>
      </p>

      <h2>Borrar</h2>
      {borrar.ok ? (
        <>
          <p>Solo para un Partido cargado por error: no tiene Alineaciones.</p>
          <FormularioBorrarPartido id={id} />
        </>
      ) : (
        <p>{TEXTO_RECHAZO[borrar.motivo]}</p>
      )}

      <p>
        <Link href={`/admin/partidos/${club}`}>Volver a los Partidos</Link>
      </p>
    </main>
  );
}
