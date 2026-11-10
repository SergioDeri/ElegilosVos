// Catálogo de Esquemas: definición estática, escrita a mano.
//
// Cada Puesto se identifica con un código global (PuestoId) que significa lo
// mismo en todos los Esquemas: "INT_I" es el interior izquierdo tanto en el
// 4-3-3 como en el 3-5-2. Dentro de un Esquema cada código aparece una sola
// vez. Los ids de Esquema y de Puesto se guardan en la base: son estables, no
// se renombran.
//
// Coordenadas normalizadas (0..1): x de izquierda a derecha (mirando hacia el
// arco rival), y desde el arco propio (0) hacia el arco rival (1).

export const ESQUEMA_IDS = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1", "4-3-1-2"] as const;
export type EsquemaId = (typeof ESQUEMA_IDS)[number];

export const PUESTO_IDS = [
  "ARQ",
  "LI",
  "LD",
  "ZAG_I",
  "ZAG_C",
  "ZAG_D",
  "CAR_I",
  "CAR_D",
  "CINCO",
  "MC_I",
  "MC_D",
  "INT_I",
  "INT_D",
  "VOL_I",
  "VOL_D",
  "EXT_I",
  "EXT_D",
  "ENG",
  "DEL",
  "DEL_I",
  "DEL_D",
] as const;
export type PuestoId = (typeof PUESTO_IDS)[number];

export const PUESTO_ARQUERO = "ARQ" satisfies PuestoId;

export interface Puesto {
  readonly id: PuestoId;
  /** Nombre para mostrar, por ejemplo "Interior izquierdo". */
  readonly etiqueta: string;
  /** Abreviatura para dibujar sobre la cancha, por ejemplo "II". */
  readonly sigla: string;
  readonly x: number;
  readonly y: number;
  readonly esArquero: boolean;
}

export interface Esquema {
  readonly id: EsquemaId;
  readonly nombre: string;
  /** Los 11 Puestos, del arquero hacia adelante y de izquierda a derecha. */
  readonly puestos: readonly Puesto[];
}

const NOMBRES: Record<PuestoId, { etiqueta: string; sigla: string }> = {
  ARQ: { etiqueta: "Arquero", sigla: "ARQ" },
  LI: { etiqueta: "Lateral izquierdo", sigla: "LI" },
  LD: { etiqueta: "Lateral derecho", sigla: "LD" },
  ZAG_I: { etiqueta: "Zaguero izquierdo", sigla: "ZI" },
  ZAG_C: { etiqueta: "Zaguero central", sigla: "ZC" },
  ZAG_D: { etiqueta: "Zaguero derecho", sigla: "ZD" },
  CAR_I: { etiqueta: "Carrilero izquierdo", sigla: "CI" },
  CAR_D: { etiqueta: "Carrilero derecho", sigla: "CD" },
  CINCO: { etiqueta: "Cinco", sigla: "5" },
  MC_I: { etiqueta: "Volante central izquierdo", sigla: "VCI" },
  MC_D: { etiqueta: "Volante central derecho", sigla: "VCD" },
  INT_I: { etiqueta: "Interior izquierdo", sigla: "II" },
  INT_D: { etiqueta: "Interior derecho", sigla: "ID" },
  VOL_I: { etiqueta: "Volante izquierdo", sigla: "VI" },
  VOL_D: { etiqueta: "Volante derecho", sigla: "VD" },
  EXT_I: { etiqueta: "Extremo izquierdo", sigla: "EI" },
  EXT_D: { etiqueta: "Extremo derecho", sigla: "ED" },
  ENG: { etiqueta: "Enganche", sigla: "ENG" },
  DEL: { etiqueta: "Centrodelantero", sigla: "DC" },
  DEL_I: { etiqueta: "Delantero izquierdo", sigla: "DI" },
  DEL_D: { etiqueta: "Delantero derecho", sigla: "DD" },
};

type Ubicacion = readonly [PuestoId, number, number];

function definir(id: EsquemaId, ubicaciones: readonly Ubicacion[]): Esquema {
  return {
    id,
    nombre: id,
    puestos: ubicaciones.map(([puesto, x, y]) => ({
      id: puesto,
      ...NOMBRES[puesto],
      x,
      y,
      esArquero: puesto === PUESTO_ARQUERO,
    })),
  };
}

const ARQUERO: Ubicacion = ["ARQ", 0.5, 0.05];
const LINEA_DE_CUATRO: readonly Ubicacion[] = [
  ["LI", 0.12, 0.22],
  ["ZAG_I", 0.37, 0.18],
  ["ZAG_D", 0.63, 0.18],
  ["LD", 0.88, 0.22],
];

export const CATALOGO: Record<EsquemaId, Esquema> = {
  "4-3-3": definir("4-3-3", [
    ARQUERO,
    ...LINEA_DE_CUATRO,
    ["CINCO", 0.5, 0.38],
    ["INT_I", 0.3, 0.55],
    ["INT_D", 0.7, 0.55],
    ["EXT_I", 0.15, 0.8],
    ["DEL", 0.5, 0.85],
    ["EXT_D", 0.85, 0.8],
  ]),
  "4-4-2": definir("4-4-2", [
    ARQUERO,
    ...LINEA_DE_CUATRO,
    ["VOL_I", 0.12, 0.52],
    ["MC_I", 0.37, 0.48],
    ["MC_D", 0.63, 0.48],
    ["VOL_D", 0.88, 0.52],
    ["DEL_I", 0.35, 0.82],
    ["DEL_D", 0.65, 0.82],
  ]),
  "4-2-3-1": definir("4-2-3-1", [
    ARQUERO,
    ...LINEA_DE_CUATRO,
    ["MC_I", 0.35, 0.42],
    ["MC_D", 0.65, 0.42],
    ["EXT_I", 0.15, 0.66],
    ["ENG", 0.5, 0.64],
    ["EXT_D", 0.85, 0.66],
    ["DEL", 0.5, 0.86],
  ]),
  "3-5-2": definir("3-5-2", [
    ARQUERO,
    ["ZAG_I", 0.25, 0.18],
    ["ZAG_C", 0.5, 0.16],
    ["ZAG_D", 0.75, 0.18],
    ["CAR_I", 0.1, 0.5],
    ["INT_I", 0.3, 0.52],
    ["CINCO", 0.5, 0.4],
    ["INT_D", 0.7, 0.52],
    ["CAR_D", 0.9, 0.5],
    ["DEL_I", 0.35, 0.82],
    ["DEL_D", 0.65, 0.82],
  ]),
  "5-3-2": definir("5-3-2", [
    ARQUERO,
    ["CAR_I", 0.08, 0.28],
    ["ZAG_I", 0.3, 0.18],
    ["ZAG_C", 0.5, 0.16],
    ["ZAG_D", 0.7, 0.18],
    ["CAR_D", 0.92, 0.28],
    ["INT_I", 0.25, 0.52],
    ["CINCO", 0.5, 0.44],
    ["INT_D", 0.75, 0.52],
    ["DEL_I", 0.35, 0.82],
    ["DEL_D", 0.65, 0.82],
  ]),
  "4-1-4-1": definir("4-1-4-1", [
    ARQUERO,
    ...LINEA_DE_CUATRO,
    ["CINCO", 0.5, 0.36],
    ["VOL_I", 0.12, 0.58],
    ["INT_I", 0.37, 0.56],
    ["INT_D", 0.63, 0.56],
    ["VOL_D", 0.88, 0.58],
    ["DEL", 0.5, 0.85],
  ]),
  // Rombo sin volantes por banda: cinco, dos interiores, enganche y dos puntas.
  "4-3-1-2": definir("4-3-1-2", [
    ARQUERO,
    ...LINEA_DE_CUATRO,
    ["CINCO", 0.5, 0.36],
    ["INT_I", 0.3, 0.5],
    ["INT_D", 0.7, 0.5],
    ["ENG", 0.5, 0.64],
    ["DEL_I", 0.35, 0.84],
    ["DEL_D", 0.65, 0.84],
  ]),
};
