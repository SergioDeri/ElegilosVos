"use client";

// Formulario de la Convocatoria (UI mínima): los elegibles del Plantel de la
// Selección y los Partidos de la Selección a los que se aplica. La validación
// real la hacen la Server Action (@/domain/convocatoria) y Postgres.
import { useActionState } from "react";
import { formatearHoraUy } from "@/domain/comun/horario";
import { ETIQUETA_POSICION } from "../../_comun/etiquetas";
import { ETIQUETA_VOTACION } from "../_partidos/textos";
import { borrarConvocatoria, guardarConvocatoria, type EstadoConvocatoria } from "./acciones";
import type { ElegibleVista, PartidoDeLaSeleccionVista } from "./datos";

const INICIAL: EstadoConvocatoria = {};

function ErrorDeCampo({ texto }: { texto?: string }) {
  return texto ? <p role="alert">{texto}</p> : null;
}

export function FormularioConvocatoria(props: {
  /** null: alta. */
  id: string | null;
  elegibles: ElegibleVista[];
  partidos: PartidoDeLaSeleccionVista[];
  convocados: readonly string[];
  aplicaA: readonly string[];
}) {
  const [estado, accion, enviando] = useActionState(guardarConvocatoria.bind(null, props.id), INICIAL);
  const convocados = new Set(props.convocados);
  const aplicaA = new Set(props.aplicaA);
  // Los dados de baja solo aparecen si ya estaban convocados.
  const elegibles = props.elegibles.filter((j) => j.enPlantel || convocados.has(j.id));
  // Los cancelados, solo si ya se aplicaba a ellos.
  const partidos = props.partidos.filter((p) => !p.cancelado || aplicaA.has(p.id));

  return (
    <form action={accion}>
      <fieldset>
        <legend>Partidos de la Selección a los que se aplica</legend>
        {partidos.length === 0 && <p>No hay Partidos de la Selección cargados.</p>}
        <ul>
          {partidos.map((p) => {
            const enOtra = p.convocatoriaId !== null && p.convocatoriaId !== props.id;
            return (
              <li key={p.id}>
                <label>
                  <input type="checkbox" name="partido" value={p.id} defaultChecked={aplicaA.has(p.id)} disabled={enOtra} /> vs{" "}
                  {p.rivalNombre} · {formatearHoraUy(new Date(p.inicio))} · Votación {ETIQUETA_VOTACION[p.votacion].toLowerCase()}
                  {p.cancelado && " · Cancelado"}
                  {enOtra && " · ya tiene otra Convocatoria"}
                </label>
              </li>
            );
          })}
        </ul>
        <ErrorDeCampo texto={estado.errores?.partidos} />
      </fieldset>

      <fieldset>
        <legend>Convocados (elegibles del Plantel de la Selección)</legend>
        <ul>
          {elegibles.map((j) => (
            <li key={j.id}>
              <label>
                <input type="checkbox" name="jugador" value={j.id} defaultChecked={convocados.has(j.id)} /> {j.nombre} ·{" "}
                {ETIQUETA_POSICION[j.posicionNatural]}
                {!j.enPlantel && " · dado de baja"}
              </label>
            </li>
          ))}
        </ul>
        <ErrorDeCampo texto={estado.errores?.jugadores} />
      </fieldset>

      {estado.mensaje && <p role="alert">{estado.mensaje}</p>}
      <button type="submit" disabled={enviando}>
        Guardar la Convocatoria
      </button>
    </form>
  );
}

export function BotonBorrarConvocatoria({ id }: { id: string }) {
  return (
    <form action={borrarConvocatoria.bind(null, id)}>
      <button type="submit">Borrar la Convocatoria</button>
    </form>
  );
}
