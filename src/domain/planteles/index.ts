// Reglas del Plantel para el backoffice (ticket 07): validación de los datos
// de un Jugador, de las imágenes que se suben (escudos) y su nombre corto
// para la cancha. Lógica pura,
// sin Next ni Supabase.
import {
  DISPONIBILIDADES,
  POSICIONES_NATURALES,
  type Disponibilidad,
  type PosicionNatural,
} from "@/domain/comun/tipos";

export const LARGO_MAXIMO_NOMBRE = 80;
export const LARGO_MAXIMO_MOTIVO = 200;

export type DatosJugador = {
  nombre: string;
  numero: number;
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

/** Nombre, número (1-99) y posición natural, tal como llegan de un formulario. */
export function validarDatosJugador(entrada: {
  nombre: unknown;
  numero: unknown;
  posicionNatural: unknown;
}): ResultadoDatos {
  const errores: Errores = {};

  const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
  if (!nombre) errores.nombre = "Falta el nombre.";
  else if (nombre.length > LARGO_MAXIMO_NOMBRE) errores.nombre = `Máximo ${LARGO_MAXIMO_NOMBRE} caracteres.`;

  const numero = aEntero(entrada.numero);
  if (numero === null || numero < 1 || numero > 99) errores.numero = "El número va de 1 a 99.";

  const posicionNatural = POSICIONES_NATURALES.find((p) => p === entrada.posicionNatural);
  if (!posicionNatural) errores.posicionNatural = "Posición natural inválida.";

  if (Object.keys(errores).length > 0 || !posicionNatural || numero === null) return { ok: false, errores };
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

function aEntero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isInteger(valor) ? valor : null;
  if (typeof valor === "string" && /^\d+$/.test(valor.trim())) return Number(valor.trim());
  return null;
}

// -----------------------------------------------------------------------------
// Imágenes subidas (escudos de Rival)
// -----------------------------------------------------------------------------

/** 2 MB. Coincide con el límite del bucket `escudos` en Storage. */
export const TAMANO_MAXIMO_FOTO = 2 * 1024 * 1024;

export const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoDeFoto = (typeof TIPOS_DE_FOTO)[number];

export type ResultadoFoto =
  | { ok: true; tipo: TipoDeFoto; extension: "jpg" | "png" | "webp" }
  | { ok: false; motivo: "vacia" | "tamano" | "formato" };

/**
 * Valida una imagen por su tamaño y su contenido real (los primeros bytes),
 * sin confiar en el tipo que declara el navegador. `cabecera`: al menos los
 * primeros 12 bytes del archivo.
 */
export function validarFoto({ tamano, cabecera }: { tamano: number; cabecera: Uint8Array }): ResultadoFoto {
  if (tamano <= 0) return { ok: false, motivo: "vacia" };
  if (tamano > TAMANO_MAXIMO_FOTO) return { ok: false, motivo: "tamano" };

  const empiezaCon = (bytes: number[], desde = 0) => bytes.every((b, i) => cabecera[desde + i] === b);

  if (empiezaCon([0xff, 0xd8, 0xff])) return { ok: true, tipo: "image/jpeg", extension: "jpg" };
  if (empiezaCon([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true, tipo: "image/png", extension: "png" };
  if (empiezaCon([0x52, 0x49, 0x46, 0x46]) && empiezaCon([0x57, 0x45, 0x42, 0x50], 8)) {
    return { ok: true, tipo: "image/webp", extension: "webp" };
  }
  return { ok: false, motivo: "formato" };
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
