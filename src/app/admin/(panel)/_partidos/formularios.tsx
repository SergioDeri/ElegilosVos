"use client";

// Formularios de Rivales y Partidos (UI mínima). La validación real la hacen
// las Server Actions (@/domain/partidos) y la autorización, Postgres.
import { useActionState } from "react";
import { CLUBES, type ClubId } from "@/domain/comun/tipos";
import { LARGO_MAXIMO_NOMBRE_RIVAL } from "@/domain/partidos";
import { CampoEscudo } from "../_componentes/campo-escudo";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import {
  borrarPartido,
  cambiarEscudo,
  cambiarEstadoPartido,
  crearPartido,
  crearRival,
  editarRival,
  reprogramarPartido,
  type EstadoPartido,
  type EstadoRival,
} from "./acciones";

function ErrorDeCampo({ texto }: { texto?: string }) {
  return texto ? <span role="alert"> {texto}</span> : null;
}

function Mensaje({ estado }: { estado: { mensaje?: string; ok?: boolean } }) {
  return estado.mensaje ? <p role={estado.ok ? "status" : "alert"}>{estado.mensaje}</p> : null;
}

// -----------------------------------------------------------------------------
// Rivales
// -----------------------------------------------------------------------------

function CamposRival({ estado, valores }: { estado: EstadoRival; valores?: { nombre: string; clubId: ClubId | null } }) {
  return (
    <>
      <p>
        <label>
          Nombre <input name="nombre" defaultValue={valores?.nombre} maxLength={LARGO_MAXIMO_NOMBRE_RIVAL} required />
        </label>
        <ErrorDeCampo texto={estado.errores?.nombre} />
      </p>
      <p>
        <label>
          ¿Es uno de los Clubes? (para el Clásico){" "}
          <select name="clubId" defaultValue={valores?.clubId ?? ""}>
            <option value="">No, es un Rival común</option>
            {CLUBES.map((c) => (
              <option key={c} value={c}>
                Sí, {NOMBRE_CLUB[c]}
              </option>
            ))}
          </select>
        </label>
        <ErrorDeCampo texto={estado.errores?.clubId} />
      </p>
    </>
  );
}

export function FormularioAltaRival() {
  const [estado, accion, enviando] = useActionState(crearRival, {});
  return (
    <form action={accion}>
      <CamposRival estado={estado} />
      <CampoEscudo error={estado.errores?.escudo} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Dar de alta
      </button>
    </form>
  );
}

export function FormularioRival(props: { id: string; nombre: string; clubId: ClubId | null }) {
  const [estado, accion, enviando] = useActionState(editarRival.bind(null, props.id), {});
  return (
    <form action={accion}>
      <CamposRival estado={estado} valores={props} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Guardar datos
      </button>
    </form>
  );
}

export function FormularioEscudo({ id }: { id: string }) {
  const [estado, accion, enviando] = useActionState(cambiarEscudo.bind(null, id), {});
  return (
    <form action={accion}>
      <CampoEscudo error={estado.errores?.escudo} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Subir escudo
      </button>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Partidos
// -----------------------------------------------------------------------------

/** Avisos del Calendario y la confirmación para guardar igual. */
function Avisos({ estado }: { estado: EstadoPartido }) {
  if (!estado.avisos?.length) return null;
  return (
    <div role="alert">
      <p>Atención, este cambio afecta el Calendario de Votación:</p>
      <ul>
        {estado.avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <label>
        <input type="checkbox" name="confirmar" value="1" required /> Entiendo, guardar igual
      </label>
    </div>
  );
}

type OpcionRival = { id: string; nombre: string };

function CamposPartido(props: { estado: EstadoPartido; rivales: OpcionRival[]; rivalId?: string; inicio?: string }) {
  const { estado } = props;
  return (
    <>
      <p>
        <label>
          Rival{" "}
          <select name="rivalId" defaultValue={estado.valores?.rivalId ?? props.rivalId ?? ""} required>
            <option value="" disabled>
              Elegí un Rival
            </option>
            {props.rivales.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
        <ErrorDeCampo texto={estado.errores?.rivalId} />
      </p>
      <CampoInicio estado={estado} inicio={props.inicio} />
    </>
  );
}

function CampoInicio({ estado, inicio }: { estado: EstadoPartido; inicio?: string }) {
  return (
    <p>
      <label>
        Inicio (hora de Uruguay){" "}
        <input name="inicio" type="datetime-local" defaultValue={estado.valores?.inicio ?? inicio} required />
      </label>
      <ErrorDeCampo texto={estado.errores?.inicio} />
    </p>
  );
}

export function FormularioAltaPartido({ club, rivales }: { club: ClubId; rivales: OpcionRival[] }) {
  const [estado, accion, enviando] = useActionState(crearPartido.bind(null, club), {});
  return (
    <form action={accion}>
      <CamposPartido estado={estado} rivales={rivales} />
      <Avisos estado={estado} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Cargar Partido
      </button>
    </form>
  );
}

export function FormularioReprogramar(props: { id: string; rivales: OpcionRival[]; rivalId: string; inicio: string }) {
  const [estado, accion, enviando] = useActionState(reprogramarPartido.bind(null, props.id), {});
  return (
    <form action={accion}>
      <CamposPartido estado={estado} rivales={props.rivales} rivalId={props.rivalId} inicio={props.inicio} />
      <Avisos estado={estado} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Guardar (postergar o cambiar horario)
      </button>
    </form>
  );
}

export function FormularioCancelar({ id }: { id: string }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoPartido.bind(null, id, "cancelar"), {});
  return (
    <form action={accion}>
      <Avisos estado={estado} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Cancelar el Partido (anula la Votación)
      </button>
    </form>
  );
}

export function FormularioReactivar({ id, inicio }: { id: string; inicio: string }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoPartido.bind(null, id, "reactivar"), {});
  return (
    <form action={accion}>
      <CampoInicio estado={estado} inicio={inicio} />
      <Avisos estado={estado} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Reactivar el Partido
      </button>
    </form>
  );
}

export function FormularioBorrarPartido({ id }: { id: string }) {
  const [estado, accion, enviando] = useActionState(borrarPartido.bind(null, id), {});
  return (
    <form action={accion}>
      <Avisos estado={estado} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Borrar el Partido
      </button>
    </form>
  );
}
