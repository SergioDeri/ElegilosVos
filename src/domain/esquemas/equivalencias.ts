// Tabla de Equivalencias (ver ADR-0001), escrita a mano.
//
// Cómo se arma: como los códigos de Puesto significan lo mismo en todos los
// Esquemas (ver catalogo.ts), para cada Esquema de DESTINO se escribe a qué
// Puesto propio va cada código de Puesto del catálogo (`RECIBE`). Así:
//
//   puestoEquivalente(origen, puesto, destino) =
//     EXCEPCIONES[origen][destino][puesto] ?? RECIBE[destino][puesto]
//
// Son 6 tablas de 21 filas en lugar de 30 pares × 11 Puestos, y el resultado
// es predecible: un Puesto que existe en el destino se queda en su lugar, y
// uno que no existe va siempre al mismo lugar, venga del Esquema que venga.
// Para los pocos casos donde el Esquema de origen cambia la mejor respuesta,
// hay excepciones explícitas por par. La tabla completa resultante está en
// el snapshot de equivalencias.test.ts.
//
// Criterios: se respeta el lado siempre; se respeta la línea salvo que el
// destino no tenga ese tipo de Puesto (entonces se corre a lo sumo una
// línea); el arquero solo va al arco. Dos Puestos de origen pueden caer en el
// mismo destino (colisión): pasa cuando el destino tiene menos Puestos de esa
// línea. El Motor de Conteo suma los dos votos; el Editor devuelve uno al
// Plantel. Las elecciones discutibles están marcadas con (*).
import { CATALOGO, type EsquemaId, type PuestoId } from "./catalogo";

type Recibe = Readonly<Record<PuestoId, PuestoId>>;

// Comunes a todos los Esquemas con línea de cuatro (4-3-3, 4-4-2, 4-2-3-1, 4-1-4-1).
const DEFENSA_DE_CUATRO = {
  ARQ: "ARQ",
  LI: "LI",
  LD: "LD",
  ZAG_I: "ZAG_I",
  // (*) De línea de tres a línea de cuatro el zaguero central colisiona con
  // uno de los dos zagueros. Va al derecho: en una línea de tres el zaguero
  // izquierdo suele ser zurdo y conviene que se quede en su lado.
  ZAG_C: "ZAG_D",
  ZAG_D: "ZAG_D",
  // El carrilero es el lateral del Esquema con línea de tres o de cinco.
  CAR_I: "LI",
  CAR_D: "LD",
} as const satisfies Partial<Recibe>;

// 3-5-2 y 5-3-2 tienen los mismos Puestos (cambian solo las coordenadas), así
// que reciben igual y entre ellos la equivalencia es Puesto a Puesto.
const TRES_Y_CINCO_ATRAS: Recibe = {
  ARQ: "ARQ",
  LI: "CAR_I",
  LD: "CAR_D",
  ZAG_I: "ZAG_I",
  ZAG_C: "ZAG_C",
  ZAG_D: "ZAG_D",
  CAR_I: "CAR_I",
  CAR_D: "CAR_D",
  CINCO: "CINCO",
  // (*) Del doble cinco, el izquierdo pasa a cinco y el derecho a interior.
  MC_I: "CINCO",
  MC_D: "INT_D",
  INT_I: "INT_I",
  INT_D: "INT_D",
  // (*) El volante por banda va al interior de su lado (misma línea) y no al
  // carrilero, que es más defensivo y ya lo ocupa el lateral.
  VOL_I: "INT_I",
  VOL_D: "INT_D",
  EXT_I: "DEL_I",
  EXT_D: "DEL_D",
  ENG: "INT_I",
  // (*) Con dos delanteros, el centrodelantero va al delantero derecho y el
  // izquierdo queda para el segundo delantero (enganche/extremo izquierdo).
  DEL: "DEL_D",
  DEL_I: "DEL_I",
  DEL_D: "DEL_D",
};

const RECIBE: Record<EsquemaId, Recibe> = {
  "4-3-3": {
    ...DEFENSA_DE_CUATRO,
    CINCO: "CINCO",
    MC_I: "CINCO",
    MC_D: "INT_D",
    INT_I: "INT_I",
    INT_D: "INT_D",
    // El volante por banda y el extremo son el jugador de banda de cada Esquema.
    VOL_I: "EXT_I",
    VOL_D: "EXT_D",
    EXT_I: "EXT_I",
    EXT_D: "EXT_D",
    ENG: "INT_I",
    DEL: "DEL",
    // Dos delanteros a un centrodelantero: colisionan (ver excepciones).
    DEL_I: "DEL",
    DEL_D: "DEL",
  },
  "4-4-2": {
    ...DEFENSA_DE_CUATRO,
    // (*) Tres volantes centrales (cinco + interiores) en dos lugares: el
    // cinco y el interior izquierdo colisionan en el volante central izquierdo.
    CINCO: "MC_I",
    MC_I: "MC_I",
    MC_D: "MC_D",
    INT_I: "MC_I",
    INT_D: "MC_D",
    VOL_I: "VOL_I",
    VOL_D: "VOL_D",
    EXT_I: "VOL_I",
    EXT_D: "VOL_D",
    // El enganche pasa a segundo delantero; el 9 queda a la derecha.
    ENG: "DEL_I",
    DEL: "DEL_D",
    DEL_I: "DEL_I",
    DEL_D: "DEL_D",
  },
  "4-2-3-1": {
    ...DEFENSA_DE_CUATRO,
    CINCO: "MC_I",
    MC_I: "MC_I",
    MC_D: "MC_D",
    // (*) Del 4-3-3 al 4-2-3-1 se invierte el triángulo: el interior
    // izquierdo pasa a enganche y el derecho al doble cinco.
    INT_I: "ENG",
    INT_D: "MC_D",
    VOL_I: "EXT_I",
    VOL_D: "EXT_D",
    EXT_I: "EXT_I",
    EXT_D: "EXT_D",
    ENG: "ENG",
    DEL: "DEL",
    // El segundo delantero baja a enganche (inverso del 4-2-3-1 → 4-4-2).
    DEL_I: "ENG",
    DEL_D: "DEL",
  },
  "3-5-2": TRES_Y_CINCO_ATRAS,
  "5-3-2": TRES_Y_CINCO_ATRAS,
  "4-1-4-1": {
    ...DEFENSA_DE_CUATRO,
    CINCO: "CINCO",
    MC_I: "CINCO",
    MC_D: "INT_D",
    INT_I: "INT_I",
    INT_D: "INT_D",
    VOL_I: "VOL_I",
    VOL_D: "VOL_D",
    EXT_I: "VOL_I",
    EXT_D: "VOL_D",
    ENG: "INT_I",
    DEL: "DEL",
    DEL_I: "DEL",
    DEL_D: "DEL",
  },
};

type Excepciones = Partial<Record<EsquemaId, Partial<Record<EsquemaId, Partial<Record<PuestoId, PuestoId>>>>>>;

// Excepciones por par (origen → destino) a la regla de RECIBE.
const EXCEPCIONES: Excepciones = {
  "4-4-2": {
    // (*) Del 4-4-2 a un Esquema con un solo delantero y dos interiores, el
    // segundo delantero baja a interior izquierdo en lugar de colisionar con
    // el 9 (el interior izquierdo quedaría vacío: el volante central
    // izquierdo pasa a cinco). Desde el 3-5-2/5-3-2 no se hace, porque ahí
    // el interior izquierdo ya está ocupado.
    "4-3-3": { DEL_I: "INT_I" },
    "4-1-4-1": { DEL_I: "INT_I" },
  },
};

/**
 * Puesto del Esquema `destino` que corresponde a `puesto` del Esquema
 * `origen`, según la Tabla de Equivalencias. Lo usan el Motor de Conteo (para
 * traducir votos al Esquema ganador) y el Editor (al cambiar de Esquema).
 * Lanza un error si `puesto` no pertenece al Esquema de origen.
 */
export function puestoEquivalente(origen: EsquemaId, puesto: PuestoId, destino: EsquemaId): PuestoId {
  if (!CATALOGO[origen].puestos.some((p) => p.id === puesto)) {
    throw new Error(`El Puesto ${puesto} no pertenece al Esquema ${origen}`);
  }
  if (origen === destino) return puesto;
  return EXCEPCIONES[origen]?.[destino]?.[puesto] ?? RECIBE[destino][puesto];
}
