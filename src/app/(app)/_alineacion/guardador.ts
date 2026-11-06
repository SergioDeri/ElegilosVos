// Guardado automático (sin React, para poder testearlo con relojes falsos).
//
// - `programar(valor)`: registra un cambio; se guarda cuando pasan `debounceMs`
//   sin otro cambio.
// - Un solo guardado en curso a la vez. Si hay cambios mientras se guarda, al
//   terminar se guarda la última versión (nunca una vieja después de una nueva).
// - Falla transitoria ("fallo"): se reintenta solo con espera creciente, siempre
//   con la versión más nueva; `reintentar()` lo hace ya.
// - "votacion_cerrada" o "invalida": se bloquea; no se guarda nada más.

export type ResultadoDeGuardar = { ok: true } | { ok: false; error: "votacion_cerrada" | "invalida" | "fallo" };

export type EstadoGuardado =
  | { tipo: "guardado" }
  | { tipo: "pendiente" }
  | { tipo: "guardando" }
  | { tipo: "error"; reintentoEnMs: number }
  | { tipo: "cerrada" }
  | { tipo: "invalida" };

export interface Guardador<T> {
  programar(valor: T): void;
  reintentar(): void;
  /** Cancela temporizadores (al desmontar). */
  destruir(): void;
}

export interface OpcionesGuardador<T> {
  guardar(valor: T): Promise<ResultadoDeGuardar>;
  alCambiarEstado(estado: EstadoGuardado): void;
  debounceMs?: number;
  reintentosMs?: readonly number[];
}

export function crearGuardador<T>({
  guardar,
  alCambiarEstado,
  debounceMs = 800,
  reintentosMs = [2000, 5000, 15000, 30000],
}: OpcionesGuardador<T>): Guardador<T> {
  let pendiente: { valor: T } | null = null;
  let enCurso = false;
  let bloqueado = false;
  let fallos = 0;
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  function esperar(ms: number) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => void ejecutar(), ms);
  }

  async function ejecutar(): Promise<void> {
    clearTimeout(temporizador);
    if (enCurso || bloqueado || !pendiente) return;
    const { valor } = pendiente;
    pendiente = null;
    enCurso = true;
    alCambiarEstado({ tipo: "guardando" });

    let resultado: ResultadoDeGuardar;
    try {
      resultado = await guardar(valor);
    } catch {
      resultado = { ok: false, error: "fallo" };
    }
    enCurso = false;

    if (resultado.ok) {
      fallos = 0;
      if (pendiente) return ejecutar();
      alCambiarEstado({ tipo: "guardado" });
      return;
    }
    if (resultado.error === "votacion_cerrada" || resultado.error === "invalida") {
      bloqueado = true;
      pendiente = null;
      alCambiarEstado({ tipo: resultado.error === "votacion_cerrada" ? "cerrada" : "invalida" });
      return;
    }
    pendiente ??= { valor };
    const espera = reintentosMs[Math.min(fallos, reintentosMs.length - 1)];
    fallos++;
    alCambiarEstado({ tipo: "error", reintentoEnMs: espera });
    esperar(espera);
  }

  return {
    programar(valor) {
      if (bloqueado) return;
      pendiente = { valor };
      if (enCurso) return; // se guarda al terminar el guardado en curso
      alCambiarEstado({ tipo: "pendiente" });
      esperar(debounceMs);
    },
    reintentar() {
      fallos = 0;
      void ejecutar();
    },
    destruir() {
      clearTimeout(temporizador);
    },
  };
}
