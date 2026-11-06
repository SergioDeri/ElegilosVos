// 11 Real de un Partido (ticket 14): el Admin marca los 11 titulares que puso
// el DT (sin Esquema), lo corrige o lo borra. Se carga desde el inicio del
// Partido.
import Link from "next/link";
import { notFound } from "next/navigation";
import { coincidencia, onceDesdeJson } from "@/domain/cierre";
import { formatearHoraUy } from "@/domain/comun/horario";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { esClubId } from "@/domain/comun/tipos";
import { ETIQUETA_POSICION } from "../../../../../_comun/etiquetas";
import { FormularioBorrarOnceReal, FormularioOnceReal } from "./formularios";

function horaActual(): Date {
  return new Date();
}

export default async function PaginaOnceReal({ params }: PageProps<"/admin/partidos/[club]/[id]/once-real">) {
  await requerirAdmin();
  const { club, id } = await params;
  if (!esClubId(club)) notFound();

  const supabase = await crearClienteServidor();
  const [{ data: partido }, { data: jugadores, error }, { data: onceReal }, { data: resultado }] = await Promise.all([
    supabase.from("partido").select("id, inicio, estado, rival(nombre)").eq("id", id).eq("club_id", club).maybeSingle(),
    supabase
      .from("jugador")
      .select("id, nombre, numero, posicion_natural, en_plantel")
      .eq("club_id", club)
      .order("en_plantel", { ascending: false })
      .order("numero"),
    supabase.from("once_real").select("jugadores, actualizado_en").eq("partido_id", id).maybeSingle(),
    supabase.from("resultado_votacion").select("estado, once").eq("partido_id", id).maybeSingle(),
  ]);
  if (!partido) notFound();
  if (error) throw error;

  const inicio = new Date(partido.inicio);
  const cancelado = partido.estado === "cancelado";
  const empezo = horaActual().getTime() >= inicio.getTime();
  const acierto =
    onceReal && resultado?.estado === "con_once"
      ? coincidencia(onceDesdeJson(resultado.once).map((a) => a.jugadorId), onceReal.jugadores)
      : null;

  return (
    <main>
      <h1>
        11 Real: {NOMBRE_CLUB[club]} vs {partido.rival?.nombre ?? "?"}
      </h1>
      <p>Inicio: {formatearHoraUy(inicio)} (hora de Uruguay)</p>
      <p>
        {onceReal
          ? `Cargado (última modificación ${formatearHoraUy(new Date(onceReal.actualizado_en))}).`
          : "Todavía no se cargó el 11 Real."}
        {acierto !== null && ` La hinchada acertó ${acierto} de 11.`}
      </p>

      {cancelado ? (
        <p>El Partido está cancelado: no tiene 11 Real.</p>
      ) : !empezo ? (
        <p>El 11 Real se carga desde el inicio del Partido.</p>
      ) : (
        <>
          <h2>{onceReal ? "Corregir" : "Cargar"}</h2>
          <p>Marcá los 11 titulares que puso el DT (sin Esquema).</p>
          <FormularioOnceReal
            club={club}
            partidoId={id}
            marcados={onceReal?.jugadores ?? []}
            jugadores={jugadores.map((j) => ({
              id: j.id,
              nombre: j.nombre,
              numero: j.numero,
              posicion: ETIQUETA_POSICION[j.posicion_natural],
              enPlantel: j.en_plantel,
            }))}
          />
        </>
      )}

      {onceReal && (
        <>
          <h2>Borrar</h2>
          <FormularioBorrarOnceReal partidoId={id} />
        </>
      )}

      <p>
        <Link href={`/admin/partidos/${club}/${id}`}>Volver al Partido</Link>
      </p>
    </main>
  );
}
