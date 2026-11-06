// Algoritmo húngaro (Kuhn-Munkres), versión O(n²·m) con potenciales.
// Interno del Motor de Conteo: no se exporta desde index.ts.
//
// Trabaja con `bigint` para que los costos lexicográficos (votos, Puestos
// con votos, horas en ms) se puedan sumar sin perder precisión.

const CERO = BigInt(0);

export interface SolucionAsignacion {
  /** Para cada fila, la columna asignada. */
  readonly columnaDeFila: readonly number[];
  readonly costo: bigint;
}

/**
 * Asignación de costo mínimo: a cada fila le toca una columna distinta.
 * Requiere `filas <= columnas`. `infinito` tiene que ser mayor que cualquier
 * costo reducido posible (en la práctica, mucho mayor que el máximo costo).
 */
export function asignacionDeCostoMinimo(costos: readonly (readonly bigint[])[], infinito: bigint): SolucionAsignacion {
  const n = costos.length;
  const m = n === 0 ? 0 : costos[0].length;
  if (n > m) throw new Error("El algoritmo húngaro requiere filas <= columnas");

  // Índices desde 1; la columna 0 es ficticia.
  const u: bigint[] = new Array<bigint>(n + 1).fill(CERO);
  const v: bigint[] = new Array<bigint>(m + 1).fill(CERO);
  const filaDeColumna: number[] = new Array<number>(m + 1).fill(0);
  const camino: number[] = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    filaDeColumna[0] = i;
    let j0 = 0;
    const minimo: bigint[] = new Array<bigint>(m + 1).fill(infinito);
    const usada: boolean[] = new Array<boolean>(m + 1).fill(false);
    do {
      usada[j0] = true;
      const i0 = filaDeColumna[j0];
      let delta = infinito;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (usada[j]) continue;
        const reducido = costos[i0 - 1][j - 1] - u[i0] - v[j];
        if (reducido < minimo[j]) {
          minimo[j] = reducido;
          camino[j] = j0;
        }
        if (minimo[j] < delta) {
          delta = minimo[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (usada[j]) {
          u[filaDeColumna[j]] += delta;
          v[j] -= delta;
        } else {
          minimo[j] -= delta;
        }
      }
      j0 = j1;
    } while (filaDeColumna[j0] !== 0);
    do {
      const j1 = camino[j0];
      filaDeColumna[j0] = filaDeColumna[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const columnaDeFila: number[] = new Array<number>(n).fill(-1);
  let costo = CERO;
  for (let j = 1; j <= m; j++) {
    const i = filaDeColumna[j];
    if (i !== 0) {
      columnaDeFila[i - 1] = j - 1;
      costo += costos[i - 1][j - 1];
    }
  }
  return { columnaDeFila, costo };
}
