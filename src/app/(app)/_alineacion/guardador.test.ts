import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearGuardador, type EstadoGuardado, type ResultadoDeGuardar } from "./guardador";

function preparar(respuestas: (ResultadoDeGuardar | "lanza")[] = []) {
  const guardados: string[] = [];
  const estados: EstadoGuardado["tipo"][] = [];
  let resolver: (() => void) | null = null;
  let manual = false;
  const guardador = crearGuardador<string>({
    debounceMs: 100,
    reintentosMs: [1000, 5000],
    alCambiarEstado: (e) => estados.push(e.tipo),
    guardar: async (valor) => {
      guardados.push(valor);
      if (manual) await new Promise<void>((r) => (resolver = r));
      const r = respuestas.shift() ?? { ok: true };
      if (r === "lanza") throw new Error("red");
      return r;
    },
  });
  return {
    guardador,
    guardados,
    estados,
    /** Hace que el próximo guardado quede colgado hasta `soltar()`. */
    colgar: () => (manual = true),
    soltar: () => {
      manual = false;
      resolver?.();
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("guardado automático", () => {
  it("espera el debounce y guarda solo la última versión", async () => {
    const { guardador, guardados, estados } = preparar();
    guardador.programar("a");
    await vi.advanceTimersByTimeAsync(50);
    guardador.programar("b");
    await vi.advanceTimersByTimeAsync(99);
    expect(guardados).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(guardados).toEqual(["b"]);
    expect(estados.at(-1)).toBe("guardado");
  });

  it("no pisa una versión nueva con una vieja: los cambios durante un guardado se guardan después", async () => {
    const p = preparar();
    p.colgar();
    p.guardador.programar("a");
    await vi.advanceTimersByTimeAsync(100);
    p.guardador.programar("b");
    p.guardador.programar("c");
    await vi.advanceTimersByTimeAsync(1000);
    expect(p.guardados).toEqual(["a"]);
    p.soltar();
    await vi.advanceTimersByTimeAsync(0);
    expect(p.guardados).toEqual(["a", "c"]);
    expect(p.estados.at(-1)).toBe("guardado");
  });

  it("ante una falla reintenta solo, con la versión más nueva", async () => {
    const p = preparar([{ ok: false, error: "fallo" }, "lanza"]);
    p.guardador.programar("a");
    await vi.advanceTimersByTimeAsync(100);
    expect(p.estados.at(-1)).toBe("error");
    p.guardador.programar("b");
    await vi.advanceTimersByTimeAsync(100);
    expect(p.guardados).toEqual(["a", "b"]);
    expect(p.estados.at(-1)).toBe("error");
    await vi.advanceTimersByTimeAsync(5000);
    expect(p.guardados).toEqual(["a", "b", "b"]);
    expect(p.estados.at(-1)).toBe("guardado");
  });

  it("reintentar guarda enseguida", async () => {
    const p = preparar([{ ok: false, error: "fallo" }]);
    p.guardador.programar("a");
    await vi.advanceTimersByTimeAsync(100);
    p.guardador.reintentar();
    await vi.advanceTimersByTimeAsync(0);
    expect(p.guardados).toEqual(["a", "a"]);
    expect(p.estados.at(-1)).toBe("guardado");
  });

  it("si la Votación cerró, se bloquea y no guarda más", async () => {
    const p = preparar([{ ok: false, error: "votacion_cerrada" }]);
    p.guardador.programar("a");
    await vi.advanceTimersByTimeAsync(100);
    expect(p.estados.at(-1)).toBe("cerrada");
    p.guardador.programar("b");
    p.guardador.reintentar();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(p.guardados).toEqual(["a"]);
  });

  it("si el servidor la rechaza por inválida, se bloquea", async () => {
    const p = preparar([{ ok: false, error: "invalida" }]);
    p.guardador.programar("a");
    await vi.advanceTimersByTimeAsync(100);
    expect(p.estados.at(-1)).toBe("invalida");
  });
});
