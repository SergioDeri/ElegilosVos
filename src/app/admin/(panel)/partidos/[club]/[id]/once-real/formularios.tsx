"use client";

// Formulario del 11 Real (UI mínima): casillas de los Jugadores del Club o de
// los elegibles de la Selección (sin número).
import { useActionState, useState } from "react";
import type { ClubOSeleccion } from "@/domain/comun/tipos";
import { JUGADORES_DEL_ONCE_REAL } from "@/domain/once-real";
import { nombreEnElPlantel } from "@/domain/planteles";
import { borrarOnceReal, guardarOnceReal, type EstadoOnceReal } from "./acciones";

export interface JugadorParaMarcar {
  id: string;
  nombre: string;
  /** null en la Selección. */
  numero: number | null;
  posicion: string;
  enPlantel: boolean;
}

function Mensaje({ estado }: { estado: EstadoOnceReal }) {
  return estado.mensaje ? <p role={estado.ok ? "status" : "alert"}>{estado.mensaje}</p> : null;
}

function Casilla({ j, marcados, cambiar }: { j: JugadorParaMarcar; marcados: Set<string>; cambiar: (id: string) => void }) {
  return (
    <li>
      <label>
        <input type="checkbox" name="jugador" value={j.id} checked={marcados.has(j.id)} onChange={() => cambiar(j.id)} />{" "}
        {nombreEnElPlantel(j)} ({j.posicion})
      </label>
    </li>
  );
}

export function FormularioOnceReal(props: {
  club: ClubOSeleccion;
  partidoId: string;
  jugadores: JugadorParaMarcar[];
  marcados: string[];
}) {
  const [estado, accion, enviando] = useActionState(guardarOnceReal.bind(null, props.club, props.partidoId), {});
  const [marcados, setMarcados] = useState(() => new Set(props.marcados));
  const cambiar = (id: string) =>
    setMarcados((previo) => {
      const nuevo = new Set(previo);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  const enPlantel = props.jugadores.filter((j) => j.enPlantel);
  const bajas = props.jugadores.filter((j) => !j.enPlantel);

  return (
    <form action={accion}>
      <p aria-live="polite">
        Marcados: {marcados.size} de {JUGADORES_DEL_ONCE_REAL}
      </p>
      <fieldset>
        <legend>Plantel</legend>
        <ul>
          {enPlantel.map((j) => (
            <Casilla key={j.id} j={j} marcados={marcados} cambiar={cambiar} />
          ))}
        </ul>
      </fieldset>
      {bajas.length > 0 && (
        <fieldset>
          <legend>Fuera del Plantel (por si se fue después del Partido)</legend>
          <ul>
            {bajas.map((j) => (
              <Casilla key={j.id} j={j} marcados={marcados} cambiar={cambiar} />
            ))}
          </ul>
        </fieldset>
      )}
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando || marcados.size !== JUGADORES_DEL_ONCE_REAL}>
        Guardar 11 Real
      </button>
    </form>
  );
}

export function FormularioBorrarOnceReal({ partidoId }: { partidoId: string }) {
  const [estado, accion, enviando] = useActionState(borrarOnceReal.bind(null, partidoId), {});
  return (
    <form action={accion}>
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Borrar el 11 Real
      </button>
    </form>
  );
}
