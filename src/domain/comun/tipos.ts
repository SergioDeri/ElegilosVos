// Tipos del dominio compartidos por todos los módulos de lógica pura.
// Reflejan los enums de la base de datos (supabase/migrations/*_esquema_base.sql).
// Si se cambia un enum en la base, hay que cambiarlo acá también.

export const CLUBES = ["penarol", "nacional"] as const;
export type ClubId = (typeof CLUBES)[number];

/** Si el valor (de un formulario, una URL o una columna de texto de la base) es un Club. */
export function esClubId(valor: unknown): valor is ClubId {
  return CLUBES.some((c) => c === valor);
}

/**
 * El Club leído de una columna de la base que es FK a `club` (siempre un
 * ClubId): otro valor es un error de la base y se lanza.
 */
export function clubIdDeLaBase(valor: string): ClubId {
  if (!esClubId(valor)) throw new Error(`Club desconocido: ${valor}`);
  return valor;
}

/**
 * La Selección (ver CONTEXT.md): no es un Club, pero en la base comparte la
 * tabla `club` para que Partido, Plantel, Alineación y resultados la reusen.
 */
export const SELECCION = "seleccion";
export type Seleccion = typeof SELECCION;

/** Dueño de un Partido o de un Plantel: uno de los dos Clubes o la Selección. */
export type ClubOSeleccion = ClubId | Seleccion;

/** Si el valor es un Club o la Selección. */
export function esClubOSeleccion(valor: unknown): valor is ClubOSeleccion {
  return valor === SELECCION || esClubId(valor);
}

/** El Club o la Selección leído de una columna FK a `club`: otro valor se lanza. */
export function clubOSeleccionDeLaBase(valor: string): ClubOSeleccion {
  if (!esClubOSeleccion(valor)) throw new Error(`Club o Selección desconocido: ${valor}`);
  return valor;
}

export const POSICIONES_NATURALES = ["ARQ", "DEF", "MED", "DEL"] as const;
export type PosicionNatural = (typeof POSICIONES_NATURALES)[number];

export const DISPONIBILIDADES = ["disponible", "lesionado", "suspendido", "no_disponible"] as const;
export type Disponibilidad = (typeof DISPONIBILIDADES)[number];

export const ESTADOS_PARTIDO = ["programado", "cancelado"] as const;
export type EstadoPartido = (typeof ESTADOS_PARTIDO)[number];

export const ROLES = ["hincha", "admin"] as const;
export type Rol = (typeof ROLES)[number];

/**
 * El número de un Jugador de un Club leído de la base (`jugador.numero`). Solo
 * los Jugadores de la Selección no llevan número: un nulo en el Plantel de un
 * Club es un error de la base y se lanza.
 */
export function numeroDeClubDeLaBase(valor: number | null): number {
  if (valor === null) throw new Error("Jugador de un Club sin número");
  return valor;
}
