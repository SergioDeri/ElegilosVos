// Reglas del Plantel para el backoffice (ticket 07): validación de los datos
// de un Jugador y su nombre corto para la cancha, y validación de los escudos
// que se suben. Lógica pura, sin Next ni Supabase.
import {
  DISPONIBILIDADES,
  POSICIONES_NATURALES,
  SELECCION,
  type ClubOSeleccion,
  type Disponibilidad,
  type PosicionNatural,
} from "@/domain/comun/tipos";

export const LARGO_MAXIMO_NOMBRE = 80;
export const LARGO_MAXIMO_MOTIVO = 200;

export type DatosJugador = {
  nombre: string;
  /** En el Plantel de un Club, de 1 a 99. En el de la Selección no hay: null. */
  numero: number | null;
  posicionNatural: PosicionNatural;
};

export type DisponibilidadConMotivo = {
  disponibilidad: Disponibilidad;
  /** Solo si no está Disponible; si no, null. */
  motivoDisponibilidad: string | null;
};

export type Jugador = DatosJugador & DisponibilidadConMotivo;

export type CampoJugador = "nombre" | "numero" | "posicionNatural" | "disponibilidad" | "motivo";
export type Errores = Partial<Record<CampoJugador, string>>;

export type ResultadoDatos = { ok: true; datos: DatosJugador } | { ok: false; errores: Errores };
export type ResultadoDisponibilidad =
  | { ok: true; disponibilidad: DisponibilidadConMotivo }
  | { ok: false; errores: Errores };
export type ResultadoJugador = { ok: true; jugador: Jugador } | { ok: false; errores: Errores };

/**
 * Nombre, número y posición natural, tal como llegan de un formulario. En el
 * Plantel de un Club el número es obligatorio (1-99); en el de la Selección no
 * se lleva (vacío).
 */
export function validarDatosJugador(entrada: {
  nombre: unknown;
  numero: unknown;
  posicionNatural: unknown;
  plantel: ClubOSeleccion;
}): ResultadoDatos {
  const errores: Errores = {};

  const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
  if (!nombre) errores.nombre = "Falta el nombre.";
  else if (nombre.length > LARGO_MAXIMO_NOMBRE) errores.nombre = `Máximo ${LARGO_MAXIMO_NOMBRE} caracteres.`;

  let numero: number | null = null;
  if (entrada.plantel === SELECCION) {
    if (!estaVacio(entrada.numero)) errores.numero = "En la Selección los Jugadores no llevan número.";
  } else {
    numero = aEntero(entrada.numero);
    if (numero === null || numero < 1 || numero > 99) errores.numero = "El número va de 1 a 99.";
  }

  const posicionNatural = POSICIONES_NATURALES.find((p) => p === entrada.posicionNatural);
  if (!posicionNatural) errores.posicionNatural = "Posición natural inválida.";

  if (Object.keys(errores).length > 0 || !posicionNatural) return { ok: false, errores };
  return { ok: true, datos: { nombre, numero, posicionNatural } };
}

/** Disponibilidad y motivo. El motivo se descarta si el Jugador está Disponible. */
export function validarDisponibilidad(entrada: { disponibilidad: unknown; motivo?: unknown }): ResultadoDisponibilidad {
  const errores: Errores = {};

  const disponibilidad = DISPONIBILIDADES.find((d) => d === entrada.disponibilidad);
  if (!disponibilidad) errores.disponibilidad = "Disponibilidad inválida.";

  const motivo = typeof entrada.motivo === "string" ? entrada.motivo.trim() : "";
  if (motivo.length > LARGO_MAXIMO_MOTIVO) errores.motivo = `Máximo ${LARGO_MAXIMO_MOTIVO} caracteres.`;

  if (Object.keys(errores).length > 0 || !disponibilidad) return { ok: false, errores };
  return {
    ok: true,
    disponibilidad: {
      disponibilidad,
      motivoDisponibilidad: disponibilidad === "disponible" || !motivo ? null : motivo,
    },
  };
}

/** Todos los datos de un Jugador (alta). */
export function validarJugador(entrada: {
  nombre: unknown;
  numero: unknown;
  posicionNatural: unknown;
  disponibilidad: unknown;
  motivo?: unknown;
  plantel: ClubOSeleccion;
}): ResultadoJugador {
  const datos = validarDatosJugador(entrada);
  const disponibilidad = validarDisponibilidad(entrada);
  if (!datos.ok || !disponibilidad.ok) {
    return {
      ok: false,
      errores: { ...(datos.ok ? {} : datos.errores), ...(disponibilidad.ok ? {} : disponibilidad.errores) },
    };
  }
  return { ok: true, jugador: { ...datos.datos, ...disponibilidad.disponibilidad } };
}

function estaVacio(valor: unknown): boolean {
  return valor === null || valor === undefined || (typeof valor === "string" && valor.trim() === "");
}

function aEntero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isInteger(valor) ? valor : null;
  if (typeof valor === "string" && /^\d+$/.test(valor.trim())) return Number(valor.trim());
  return null;
}

// -----------------------------------------------------------------------------
// Escudos (de Club y de Rival): PNG pixel art de exactamente 48x48
// -----------------------------------------------------------------------------

export const LADO_ESCUDO = 48;

/** 64 KB: sobra para un PNG de 48x48. Coincide con el límite del bucket `escudos`. */
export const TAMANO_MAXIMO_ESCUDO = 64 * 1024;

/** Bytes del principio del archivo que hacen falta: firma (8) + largo y tipo del IHDR (8) + ancho y alto (8). */
export const CABECERA_ESCUDO = 24;

export type MotivoEscudoInvalido = "vacia" | "tamano" | "formato" | "dimensiones";

export type ResultadoEscudo =
  | { ok: true; tipo: "image/png"; extension: "png" }
  | { ok: false; motivo: MotivoEscudoInvalido };

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = [0x49, 0x48, 0x44, 0x52];

/**
 * Valida un escudo por su tamaño y su contenido real, sin confiar en el tipo
 * que declara el navegador: tiene que ser PNG (por la firma) y su cabecera
 * (el chunk IHDR, que va primero) tiene que declarar 48x48. `cabecera`: al
 * menos los primeros CABECERA_ESCUDO bytes del archivo.
 */
export function validarEscudo({ tamano, cabecera }: { tamano: number; cabecera: Uint8Array }): ResultadoEscudo {
  if (tamano <= 0) return { ok: false, motivo: "vacia" };
  if (tamano > TAMANO_MAXIMO_ESCUDO) return { ok: false, motivo: "tamano" };

  const empiezaCon = (bytes: number[], desde = 0) => bytes.every((b, i) => cabecera[desde + i] === b);
  if (cabecera.length < CABECERA_ESCUDO || !empiezaCon(FIRMA_PNG) || !empiezaCon(IHDR, 12)) {
    return { ok: false, motivo: "formato" };
  }

  const datos = new DataView(cabecera.buffer, cabecera.byteOffset, cabecera.byteLength);
  if (datos.getUint32(16) !== LADO_ESCUDO || datos.getUint32(20) !== LADO_ESCUDO) return { ok: false, motivo: "dimensiones" };
  return { ok: true, tipo: "image/png", extension: "png" };
}

// -----------------------------------------------------------------------------
// Nombre corto
// -----------------------------------------------------------------------------

/**
 * Nombre del Jugador para rotularlo en la cancha: el apellido (todo menos el
 * primer nombre; si es una sola palabra, esa), con los espacios normalizados.
 *
 * Con `largoMaximo` (caracteres disponibles), muestra el nombre completo si
 * entra; si no, el apellido, y si tampoco entra lo corta con "…".
 */
export function nombreCorto(nombre: string, largoMaximo?: number): string {
  const palabras = nombre.trim().split(/\s+/);
  const completo = palabras.join(" ");
  const apellido = palabras.length > 1 ? palabras.slice(1).join(" ") : completo;
  if (largoMaximo === undefined) return apellido;
  if (completo.length <= largoMaximo) return completo;
  return apellido.length <= largoMaximo ? apellido : `${apellido.slice(0, largoMaximo - 1).trimEnd()}…`;
}
