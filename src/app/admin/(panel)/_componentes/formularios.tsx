"use client";

// Formularios del backoffice (UI mínima). La validación real la hacen las
// Server Actions (src/domain/planteles) y la autorización, Postgres.
import { useActionState } from "react";
import { CLUBES, DISPONIBILIDADES, POSICIONES_NATURALES, type ClubId, type Disponibilidad, type PosicionNatural } from "@/domain/comun/tipos";
import { LARGO_MAXIMO_MOTIVO, LARGO_MAXIMO_NOMBRE, TIPOS_DE_FOTO } from "@/domain/planteles";
import { NOMBRE_CLUB, NOMBRE_DISPONIBILIDAD } from "@/domain/comun/textos";
import { ETIQUETA_POSICION } from "../../_comun/etiquetas";
import {
  cambiarClubDeHincha,
  cambiarDisponibilidad,
  cambiarFoto,
  crearJugador,
  editarDatosJugador,
  type EstadoFormulario,
} from "../acciones";

const INICIAL: EstadoFormulario = {};

function ErrorDeCampo({ texto }: { texto?: string }) {
  return texto ? <span role="alert"> {texto}</span> : null;
}

function Mensaje({ estado }: { estado: EstadoFormulario }) {
  return estado.mensaje ? <p role={estado.ok ? "status" : "alert"}>{estado.mensaje}</p> : null;
}

function CamposDatos({ estado, valores }: { estado: EstadoFormulario; valores?: { nombre: string; numero: number; posicionNatural: PosicionNatural } }) {
  return (
    <>
      <p>
        <label>
          Nombre <input name="nombre" defaultValue={valores?.nombre} maxLength={LARGO_MAXIMO_NOMBRE} required />
        </label>
        <ErrorDeCampo texto={estado.errores?.nombre} />
      </p>
      <p>
        <label>
          Número <input name="numero" type="number" min={1} max={99} defaultValue={valores?.numero} required />
        </label>
        <ErrorDeCampo texto={estado.errores?.numero} />
      </p>
      <p>
        <label>
          Posición natural{" "}
          <select name="posicionNatural" defaultValue={valores?.posicionNatural ?? "MED"}>
            {POSICIONES_NATURALES.map((p) => (
              <option key={p} value={p}>
                {ETIQUETA_POSICION[p]}
              </option>
            ))}
          </select>
        </label>
        <ErrorDeCampo texto={estado.errores?.posicionNatural} />
      </p>
    </>
  );
}

function CamposDisponibilidad({ estado, valores }: { estado: EstadoFormulario; valores?: { disponibilidad: Disponibilidad; motivo: string | null } }) {
  return (
    <>
      <p>
        <label>
          Disponibilidad{" "}
          <select name="disponibilidad" defaultValue={valores?.disponibilidad ?? "disponible"}>
            {DISPONIBILIDADES.map((d) => (
              <option key={d} value={d}>
                {NOMBRE_DISPONIBILIDAD[d]}
              </option>
            ))}
          </select>
        </label>
        <ErrorDeCampo texto={estado.errores?.disponibilidad} />
      </p>
      <p>
        <label>
          Motivo (si no está Disponible){" "}
          <input name="motivo" defaultValue={valores?.motivo ?? ""} maxLength={LARGO_MAXIMO_MOTIVO} />
        </label>
        <ErrorDeCampo texto={estado.errores?.motivo} />
      </p>
    </>
  );
}

function CampoFoto({ estado }: { estado: EstadoFormulario }) {
  return (
    <p>
      <label>
        Foto (JPG, PNG o WebP, hasta 2 MB) <input name="foto" type="file" accept={TIPOS_DE_FOTO.join(",")} />
      </label>
      <ErrorDeCampo texto={estado.errores?.foto} />
    </p>
  );
}

export function FormularioAlta({ club }: { club: ClubId }) {
  const [estado, accion, enviando] = useActionState(crearJugador.bind(null, club), INICIAL);
  return (
    <form action={accion}>
      <CamposDatos estado={estado} />
      <CamposDisponibilidad estado={estado} />
      <CampoFoto estado={estado} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Dar de alta
      </button>
    </form>
  );
}

export function FormularioDatos(props: { id: string; nombre: string; numero: number; posicionNatural: PosicionNatural }) {
  const [estado, accion, enviando] = useActionState(editarDatosJugador.bind(null, props.id), INICIAL);
  return (
    <form action={accion}>
      <CamposDatos estado={estado} valores={props} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Guardar datos
      </button>
    </form>
  );
}

export function FormularioDisponibilidad(props: { id: string; disponibilidad: Disponibilidad; motivo: string | null }) {
  const [estado, accion, enviando] = useActionState(cambiarDisponibilidad.bind(null, props.id), INICIAL);
  return (
    <form action={accion}>
      <CamposDisponibilidad estado={estado} valores={props} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Guardar Disponibilidad
      </button>
    </form>
  );
}

export function FormularioFoto({ id }: { id: string }) {
  const [estado, accion, enviando] = useActionState(cambiarFoto.bind(null, id), INICIAL);
  return (
    <form action={accion}>
      <CampoFoto estado={estado} />
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando}>
        Subir foto
      </button>
    </form>
  );
}

export function FormularioClubHincha({ hinchaId, clubActual }: { hinchaId: string; clubActual: ClubId | null }) {
  const [estado, accion, enviando] = useActionState(cambiarClubDeHincha.bind(null, hinchaId), INICIAL);
  return (
    <form action={accion}>
      <select name="club" defaultValue={clubActual ?? ""} required>
        <option value="" disabled>
          Elegí un Club
        </option>
        {CLUBES.map((c) => (
          <option key={c} value={c}>
            {NOMBRE_CLUB[c]}
          </option>
        ))}
      </select>{" "}
      <button type="submit" disabled={enviando}>
        Cambiar Club Favorito
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}
