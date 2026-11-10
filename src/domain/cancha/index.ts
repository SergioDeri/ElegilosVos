// Disposición de la cancha pixel (spec .scratch/diseno-pixel-art, ticket 03).
// Lógica pura: a partir del espacio disponible decide la orientación, cuánto
// ocupa el banco, el tamaño de la cancha, su dibujo y dónde va cada Puesto,
// todo en píxeles de arte enteros y sin que ninguna Camiseta ni apellido se
// pise con otro.
import { esquema as esquemaDe, type EsquemaId, type PuestoId } from "@/domain/esquemas";
import { ALTO_TEXTO, LADO_ICONO, PALETA, anchoTexto, camiseta, textoBitmap, type Matriz } from "@/domain/pixel";
import { nombreCorto } from "@/domain/planteles";

export type Orientacion = "vertical" | "horizontal";

/** Rectángulo en píxeles de arte enteros. */
export interface Rect {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Caja de un Puesto (Camiseta arriba, apellido abajo), relativa a la cancha. */
export interface PuestoEnCancha extends Rect {
  id: PuestoId;
  sigla: string;
  etiqueta: string;
}

/**
 * Banco de suplentes, relativo al área. En vertical va debajo de la cancha,
 * con hasta FILAS_BANCO filas; en horizontal, a la derecha, con hasta
 * COLUMNAS_BANCO columnas. Si los suplentes no entran, la grilla se scrollea
 * dentro de la ventana (de costado en vertical, hacia abajo en horizontal) y
 * a los lados de la ventana van dos flechas.
 */
export interface Banco extends Rect {
  /** Tamaño de la grilla entera (puede ser más grande que la ventana). */
  columnas: number;
  filas: number;
  anchoItem: number;
  altoItem: number;
  separacion: number;
  /** Orden en que se llena la grilla: por filas o por columnas. */
  flujo: "row" | "column";
  /** Parte visible de la grilla, relativa al banco. Arriba va el título "SUPLENTES". */
  ventana: Rect;
  /** Hacia dónde se scrollea la ventana; null si entran todos. */
  desplazamiento: "horizontal" | "vertical" | null;
  /** Flechas de scroll (antes y después de la ventana), relativas al banco; null sin scroll. */
  flechas: { antes: Rect; despues: Rect } | null;
}

export interface Disposicion {
  orientacion: Orientacion;
  /** Área total (cancha más banco) en píxeles de arte: floor(espacio / --px). */
  ancho: number;
  alto: number;
  /** Cancha, relativa al área. */
  cancha: Rect;
  /** El césped con sus líneas, del tamaño de la cancha. */
  dibujo: Matriz;
  puestos: PuestoEnCancha[];
  /** null si no hay suplentes. */
  banco: Banco | null;
}

/** Lado de la Camiseta: la caja de un Puesto nunca es más angosta. */
export const LADO_CAMISETA_EN_CANCHA = 24;
/** Camiseta (24) más el apellido con contorno (8), apoyado en el ruedo. */
export const ALTO_CAJA = 31;
/**
 * Caja con el nombre completo en dos renglones (Selección): la Camiseta y el
 * rótulo de `rotuloCompleto` en dos líneas.
 */
export const ALTO_CAJA_DOS_RENGLONES = ALTO_CAJA + ALTO_TEXTO + 1;
/** Renglones del rótulo de cada caja: 1 con el apellido (Clubes), 2 con el nombre completo (Selección). */
export type Renglones = 1 | 2;

function altoDeCaja(renglones: Renglones): number {
  return renglones === 2 ? ALTO_CAJA_DOS_RENGLONES : ALTO_CAJA;
}
/** Ancho máximo de la caja de un Puesto (el apellido no se estira más). */
const ANCHO_MAXIMO_CAJA = 48;
/** Separación mínima entre cajas vecinas. */
const AIRE = 2;
const MEDIA_CAMISETA = LADO_CAMISETA_EN_CANCHA / 2;

const SEPARACION_BANCO = 3;
const SEPARACION_CANCHA_BANCO = 4;
export const TITULO_BANCO = "SUPLENTES";
const ALTO_TITULO_BANCO = 6;
/** Filas del banco debajo de la cancha (vertical) y columnas del banco al costado (horizontal). */
export const FILAS_BANCO = 3;
export const COLUMNAS_BANCO = 3;
/** Las flechas de scroll del banco son íconos de 8x8. */
const LADO_FLECHA = LADO_ICONO;
/** Anchos posibles de cada suplente, del más cómodo al más apretado. */
const ANCHOS_ITEM_BANCO = [40, 38, 36, 34, 32, 30, 28, 26, 24];

// -----------------------------------------------------------------------------
// Disposición
// -----------------------------------------------------------------------------

export interface PedidoDeDisposicion {
  /** Espacio disponible para cancha y banco, en píxeles CSS. */
  ancho: number;
  alto: number;
  /** Píxeles CSS por píxel de arte. */
  px: number;
  esquema: EsquemaId;
  suplentes: number;
  /** Renglones del rótulo de cada caja (1 por defecto; 2 en la Selección, con el nombre completo). */
  renglones?: Renglones;
}

/**
 * La cancha y el banco en el espacio dado. En un espacio más alto que ancho
 * la cancha va vertical (arco propio abajo) con el banco debajo; si no,
 * horizontal (arco propio a la izquierda, el lado izquierdo del equipo
 * arriba) con el banco a la derecha. Achica los suplentes hasta que el 11
 * entre en la cancha sin pisarse.
 */
export function disponer(pedido: PedidoDeDisposicion): Disposicion {
  const ancho = Math.floor(pedido.ancho / pedido.px);
  const alto = Math.floor(pedido.alto / pedido.px);
  const orientacion: Orientacion = pedido.alto > pedido.ancho ? "vertical" : "horizontal";
  const e = esquemaDe(pedido.esquema);
  const altoCaja = altoDeCaja(pedido.renglones ?? 1);

  let ultima: { cancha: Rect; banco: Banco | null } | null = null;
  const anchos = pedido.suplentes > 0 ? ANCHOS_ITEM_BANCO : [0];
  for (const anchoItem of anchos) {
    const partes = repartir(ancho, alto, orientacion, pedido.suplentes, anchoItem, altoCaja);
    ultima = partes;
    for (const escala of ESCALAS) {
      const puestos = ubicar(e.puestos, partes.cancha.ancho, partes.cancha.alto, orientacion, altoCaja, escala);
      if (puestos) return { orientacion, ancho, alto, ...partes, puestos, dibujo: dibujoDeCancha(partes.cancha, orientacion) };
    }
  }
  // No entra ni con el banco más apretado: se ubica igual (puede pisarse).
  const partes = ultima!;
  const puestos = ubicar(e.puestos, partes.cancha.ancho, partes.cancha.alto, orientacion, altoCaja, 1, true)!;
  return { orientacion, ancho, alto, ...partes, puestos, dibujo: dibujoDeCancha(partes.cancha, orientacion) };
}

function repartir(
  ancho: number,
  alto: number,
  orientacion: Orientacion,
  suplentes: number,
  anchoItem: number,
  altoCaja: number,
): { cancha: Rect; banco: Banco | null } {
  if (suplentes === 0) return { cancha: { x: 0, y: 0, ancho, alto }, banco: null };
  const s = SEPARACION_BANCO;
  const y = ALTO_TITULO_BANCO + s;
  const largo = (n: number, item: number) => n * item + (n - 1) * s;
  const caben = (espacio: number, item: number) => Math.max(1, Math.floor((espacio + s) / (item + s)));
  const comun = { anchoItem, altoItem: altoCaja, separacion: s };

  if (orientacion === "vertical") {
    const entran = caben(ancho, anchoItem);
    let banco: Omit<Banco, "x" | "y" | "ancho" | "alto">;
    if (suplentes <= entran * FILAS_BANCO) {
      const filas = Math.ceil(suplentes / entran);
      const ventana = { x: 0, y, ancho: largo(entran, anchoItem), alto: largo(filas, altoCaja) };
      banco = { ...comun, columnas: entran, filas, flujo: "row", ventana, desplazamiento: null, flechas: null };
    } else {
      // Flecha, aire, ventana, aire, flecha: la ventana muestra columnas enteras.
      const visibles = caben(ancho - 2 * (LADO_FLECHA + s), anchoItem);
      const ventana = { x: LADO_FLECHA + s, y, ancho: largo(visibles, anchoItem), alto: largo(FILAS_BANCO, altoCaja) };
      const yFlecha = y + Math.floor((ventana.alto - LADO_FLECHA) / 2);
      banco = {
        ...comun,
        columnas: Math.ceil(suplentes / FILAS_BANCO),
        filas: FILAS_BANCO,
        flujo: "column",
        ventana,
        desplazamiento: "horizontal",
        flechas: {
          antes: { x: 0, y: yFlecha, ancho: LADO_FLECHA, alto: LADO_FLECHA },
          despues: { x: ventana.x + ventana.ancho + s, y: yFlecha, ancho: LADO_FLECHA, alto: LADO_FLECHA },
        },
      };
    }
    const altoBanco = banco.ventana.y + banco.ventana.alto;
    const altoCancha = Math.max(0, alto - altoBanco - SEPARACION_CANCHA_BANCO);
    return {
      cancha: { x: 0, y: 0, ancho, alto: altoCancha },
      banco: { x: 0, y: alto - altoBanco, ancho, alto: altoBanco, ...banco },
    };
  }

  const entran = caben(alto - y, altoCaja);
  if (suplentes <= entran * COLUMNAS_BANCO) {
    const columnas = Math.min(COLUMNAS_BANCO, Math.ceil(suplentes / entran));
    const filas = Math.ceil(suplentes / columnas);
    const ventana = { x: 0, y, ancho: largo(columnas, anchoItem), alto: largo(filas, altoCaja) };
    const anchoBanco = Math.max(anchoTexto(TITULO_BANCO), ventana.ancho);
    return {
      cancha: { x: 0, y: 0, ancho: Math.max(0, ancho - anchoBanco - SEPARACION_CANCHA_BANCO), alto },
      banco: { x: ancho - anchoBanco, y: 0, ancho: anchoBanco, alto, ...comun, columnas, filas, flujo: "row", ventana, desplazamiento: null, flechas: null },
    };
  }
  // Flecha arriba, ventana con filas enteras y flecha abajo.
  const visibles = caben(alto - y - 2 * (LADO_FLECHA + s), altoCaja);
  const ventana = { x: 0, y: y + LADO_FLECHA + s, ancho: largo(COLUMNAS_BANCO, anchoItem), alto: largo(visibles, altoCaja) };
  const anchoBanco = Math.max(anchoTexto(TITULO_BANCO), ventana.ancho);
  const xFlecha = Math.floor((ventana.ancho - LADO_FLECHA) / 2);
  return {
    cancha: { x: 0, y: 0, ancho: Math.max(0, ancho - anchoBanco - SEPARACION_CANCHA_BANCO), alto },
    banco: {
      x: ancho - anchoBanco,
      y: 0,
      ancho: anchoBanco,
      alto,
      ...comun,
      columnas: COLUMNAS_BANCO,
      filas: Math.ceil(suplentes / COLUMNAS_BANCO),
      flujo: "row",
      ventana,
      desplazamiento: "vertical",
      flechas: {
        antes: { x: xFlecha, y, ancho: LADO_FLECHA, alto: LADO_FLECHA },
        despues: { x: xFlecha, y: ventana.y + ventana.alto + s, ancho: LADO_FLECHA, alto: LADO_FLECHA },
      },
    },
  };
}

/** Cuánto del largo de la cancha se usa para separar las líneas, de más a menos. */
const ESCALAS = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5];

interface PuestoDelEsquema {
  id: PuestoId;
  sigla: string;
  etiqueta: string;
  x: number;
  y: number;
}

/**
 * Centros de los Puestos en la cancha de `ancho`×`alto`. Las coordenadas del
 * catálogo se estiran al largo de la cancha (el arquero junto al arco propio,
 * el más adelantado junto al rival) y, si dos Camisetas se pisan, la de más
 * adelante se corre hacia el arco rival. null si así no entran.
 */
function ubicar(
  puestos: readonly PuestoDelEsquema[],
  ancho: number,
  alto: number,
  orientacion: Orientacion,
  altoCaja: number,
  escala: number,
  aunqueSePisen = false,
): PuestoEnCancha[] | null {
  const vertical = orientacion === "vertical";
  // Margen para que la caja (Camiseta arriba, apellido abajo) quede adentro.
  const arriba = MEDIA_CAMISETA + 1;
  const abajo = altoCaja - MEDIA_CAMISETA + 1;
  const costado = vertical ? MEDIA_CAMISETA + 1 : MEDIA_CAMISETA + 5;
  // Eje lateral (de izquierda a derecha del equipo) y eje de profundidad
  // (del arco propio al rival), en coordenadas de pantalla.
  const lateral = vertical ? { desde: costado, hasta: ancho - costado } : { desde: arriba, hasta: alto - abajo };
  const profundidad = vertical
    ? { desde: alto - abajo, hasta: arriba, sentido: -1 }
    : { desde: costado, hasta: ancho - costado, sentido: 1 };
  if (lateral.hasta < lateral.desde || (profundidad.hasta - profundidad.desde) * profundidad.sentido < 0)
    return aunqueSePisen ? [] : null;
  // Distancia mínima entre centros para que dos Camisetas no se pisen.
  const sepLateral = vertical ? LADO_CAMISETA_EN_CANCHA + AIRE : altoCaja + 1;
  const sepProfundidad = vertical ? altoCaja + 1 : LADO_CAMISETA_EN_CANCHA + AIRE;

  const ys = puestos.map((p) => p.y);
  const yMin = Math.min(...ys);
  const rango = Math.max(...ys) - yMin || 1;
  const largo = Math.abs(profundidad.hasta - profundidad.desde);

  const ubicados: { p: PuestoDelEsquema; lat: number; prof: number }[] = [];
  const enOrden = [...puestos].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of enOrden) {
    const lat = lateral.desde + Math.round(p.x * (lateral.hasta - lateral.desde));
    let avance = Math.round(((p.y - yMin) / rango) * escala * largo);
    for (let cambio = true; cambio; ) {
      cambio = false;
      for (const q of ubicados) {
        if (Math.abs(lat - q.lat) < sepLateral && Math.abs(avance - q.prof) < sepProfundidad) {
          avance = Math.max(avance, q.prof + sepProfundidad);
          cambio = true;
        }
      }
    }
    if (avance > largo && !aunqueSePisen) return null;
    ubicados.push({ p, lat, prof: Math.min(avance, largo) });
  }

  const centros = ubicados.map(({ p, lat, prof }) => {
    const enProfundidad = profundidad.desde + profundidad.sentido * prof;
    return { p, cx: vertical ? lat : enProfundidad, cy: vertical ? enProfundidad : lat };
  });

  const cajas: PuestoEnCancha[] = [];
  for (const { p, cx, cy } of centros) {
    let limite = Math.min(ANCHO_MAXIMO_CAJA, 2 * cx, 2 * (ancho - cx));
    for (const o of centros)
      if (o.p !== p && Math.abs(o.cy - cy) < altoCaja + 1) limite = Math.min(limite, Math.abs(o.cx - cx) - AIRE);
    const anchoCaja = limite - (limite % 2);
    if (anchoCaja < LADO_CAMISETA_EN_CANCHA && !aunqueSePisen) return null;
    const a = Math.max(anchoCaja, LADO_CAMISETA_EN_CANCHA);
    cajas.push({ id: p.id, sigla: p.sigla, etiqueta: p.etiqueta, x: cx - a / 2, y: cy - MEDIA_CAMISETA, ancho: a, alto: altoCaja });
  }
  // En el orden del catálogo.
  return puestos.map((p) => cajas.find((c) => c.id === p.id)!);
}

// -----------------------------------------------------------------------------
// Rótulos y Puesto libre
// -----------------------------------------------------------------------------

/**
 * El apellido del Jugador en texto bitmap con contorno, centrado en una
 * matriz de exactamente `ancho` columnas. Si no entra, se acorta con un punto.
 */
export function rotulo(nombre: string, ancho: number): Matriz {
  return centrada(textoBitmap(apellidoQueEntra(nombre, ancho), "cal", { contorno: true }), ancho);
}

/** Alto de una línea de rótulo con contorno. */
const ALTO_LINEA = ALTO_TEXTO + 2;
/** Alto del rótulo en dos líneas: la segunda comparte con la primera una fila de contorno. */
export const ALTO_ROTULO_DOS_LINEAS = 2 * ALTO_LINEA - 1;

/**
 * El nombre completo del Jugador (en la Selección, que no lleva número), en
 * texto bitmap con contorno y centrado en `ancho` columnas. Si no entra en una
 * línea, va en dos, cortando entre palabras donde la más ancha de las dos
 * quede más angosta. **Nunca se acorta**: si aun así una línea no entra (una
 * palabra muy larga o una caja angosta), la matriz es más ancha que `ancho` y
 * quien la dibuja la centra sobre su caja.
 */
export function rotuloCompleto(nombre: string, ancho: number): Matriz {
  const palabras = nombre.trim().split(/\s+/);
  const completo = palabras.join(" ");
  const anchoLinea = (t: string) => anchoTexto(t) + 2;
  if (palabras.length === 1 || anchoLinea(completo) <= ancho) {
    return centrada(textoBitmap(completo, "cal", { contorno: true }), Math.max(ancho, anchoLinea(completo)));
  }
  let lineas: [string, string] = [palabras[0], palabras.slice(1).join(" ")];
  for (let i = 2; i < palabras.length; i++) {
    const candidata: [string, string] = [palabras.slice(0, i).join(" "), palabras.slice(i).join(" ")];
    if (Math.max(...candidata.map(anchoLinea)) < Math.max(...lineas.map(anchoLinea))) lineas = candidata;
  }
  const total = Math.max(ancho, ...lineas.map(anchoLinea));
  const [arriba, abajo] = lineas.map((l) => centrada(textoBitmap(l, "cal", { contorno: true }), total));
  // La última fila de la primera línea y la primera de la segunda son contorno: se superponen.
  return [...arriba.slice(0, ALTO_LINEA - 1), arriba[ALTO_LINEA - 1].map((c, x) => c ?? abajo[0][x]), ...abajo.slice(1)];
}

/** La matriz centrada en exactamente `ancho` columnas (si es más angosta). */
function centrada(m: Matriz, ancho: number): Matriz {
  const sobra = Math.max(0, ancho - (m[0]?.length ?? 0));
  const izquierda = Math.floor(sobra / 2);
  return m.map((fila) => [
    ...Array<string | null>(izquierda).fill(null),
    ...fila,
    ...Array<string | null>(sobra - izquierda).fill(null),
  ]);
}

function apellidoQueEntra(nombre: string, ancho: number): string {
  const entra = (t: string) => anchoTexto(t) + 2 <= ancho;
  const apellido = nombreCorto(nombre);
  if (entra(apellido)) return apellido;
  const letras = [...apellido];
  for (let n = letras.length - 1; n > 0; n--) {
    const corto = `${letras.slice(0, n).join("").trimEnd()}.`;
    if (entra(corto)) return corto;
  }
  return "";
}

/** Un Puesto vacío: la silueta de una Camiseta en el césped. */
export function siluetaDePuestoLibre(): Matriz {
  return camiseta("nacional", "DEF").map((fila) =>
    fila.map((c) => (c === null ? null : c === PALETA.contorno ? PALETA.cespedOscuro : PALETA.cespedSombra)),
  );
}

// -----------------------------------------------------------------------------
// Dibujo de la cancha: franjas, matas por tile de 16x16, líneas de cal y arcos
// -----------------------------------------------------------------------------

const MARGEN_LINEAS = 6;
const TILE = 16;

/** Hash determinista: las matas no cambian entre renders. */
function hash(a: number, b: number, s: number): number {
  let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Solo el césped con sus líneas, de `ancho`×`alto` píxeles de arte (sin
 * Puestos ni banco): el fondo de las pantallas de acceso. Vertical si es más
 * alto que ancho; si no, horizontal.
 */
export function canchaDeFondo(ancho: number, alto: number): Matriz {
  const a = Math.max(0, Math.floor(ancho));
  const h = Math.max(0, Math.floor(alto));
  return dibujoDeCancha({ x: 0, y: 0, ancho: a, alto: h }, h > a ? "vertical" : "horizontal");
}

function dibujoDeCancha(cancha: Rect, orientacion: Orientacion): Matriz {
  if (orientacion === "vertical") return canchaVertical(cancha.ancho, cancha.alto);
  // Se dibuja vertical (ancho = alto de pantalla) y se gira: arco propio a la
  // izquierda y el lado izquierdo del equipo arriba.
  const v = canchaVertical(cancha.alto, cancha.ancho);
  const largo = cancha.ancho;
  return Array.from({ length: cancha.alto }, (_, fila) => Array.from({ length: largo }, (_, col) => v[largo - 1 - col][fila]));
}

function canchaVertical(W: number, H: number): Matriz {
  const M = MARGEN_LINEAS;
  const m: Matriz = Array.from({ length: H }, (_, y) =>
    Array<string | null>(W).fill(Math.floor(y / TILE) % 2 === 0 ? PALETA.cesped : PALETA.cespedLuz),
  );
  const pon = (x: number, y: number, c: string = PALETA.cal) => {
    if (y >= 0 && y < H && x >= 0 && x < W) m[y][x] = c;
  };

  // Matas: variantes por tile para que no se note el patrón.
  for (let ty = 0; ty < Math.ceil(H / TILE); ty++)
    for (let tx = 0; tx < Math.ceil(W / TILE); tx++)
      for (let i = 0; i < 2; i++) {
        if (hash(tx, ty, i) < 0.35) continue;
        const x = tx * TILE + 1 + Math.floor(hash(tx, ty, i + 10) * 13);
        const y = ty * TILE + 2 + Math.floor(hash(tx, ty, i + 20) * 12);
        pon(x, y, PALETA.cespedSombra);
        pon(x + 1, y - 1, PALETA.cespedSombra);
        pon(x + 2, y, PALETA.cespedSombra);
      }

  if (W < 4 * M || H < 4 * M) return m;

  const hLinea = (x1: number, x2: number, y: number) => {
    for (let x = x1; x <= x2; x++) pon(x, y);
  };
  const vLinea = (x: number, y1: number, y2: number) => {
    for (let y = y1; y <= y2; y++) pon(x, y);
  };
  const rect = (x1: number, y1: number, x2: number, y2: number) => {
    hLinea(x1, x2, y1);
    hLinea(x1, x2, y2);
    vLinea(x1, y1, y2);
    vLinea(x2, y1, y2);
  };
  const circulo = (cx: number, cy: number, r: number, filtro: (y: number) => boolean = () => true) => {
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      for (const [dx, dy] of [
        [x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y],
      ]) {
        if (filtro(cy + dy)) pon(cx + dx, cy + dy);
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  };

  const x2 = W - 1 - M;
  const y2 = H - 1 - M;
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);
  const anchoUtil = x2 - M;
  const largoUtil = y2 - M;
  const areaW = Math.round(anchoUtil * 0.27);
  const areaH = Math.round(largoUtil * 0.15);
  const chicaW = Math.round(anchoUtil * 0.125);
  const chicaH = Math.round(largoUtil * 0.055);
  const radio = Math.round(Math.min(anchoUtil, largoUtil) * 0.13);
  const arcoW = Math.max(2, Math.round(anchoUtil * 0.07));

  rect(M, M, x2, y2);
  hLinea(M, x2, cy);
  circulo(cx, cy, radio);
  pon(cx, cy);
  pon(cx - 1, cy);
  rect(cx - areaW, M, cx + areaW - 1, M + areaH);
  rect(cx - chicaW, M, cx + chicaW - 1, M + chicaH);
  rect(cx - areaW, y2 - areaH, cx + areaW - 1, y2);
  rect(cx - chicaW, y2 - chicaH, cx + chicaW - 1, y2);
  const medialuna = Math.round(radio * 0.75);
  circulo(cx, M + Math.round(areaH * 0.7), medialuna, (y) => y > M + areaH);
  circulo(cx, y2 - Math.round(areaH * 0.7), medialuna, (y) => y < y2 - areaH);
  // Arcos con red, detrás de cada línea de fondo.
  for (const [ya, yb] of [
    [M - 5, M - 1],
    [y2 + 1, y2 + 5],
  ]) {
    for (let y = ya; y <= yb; y++)
      for (let x = cx - arcoW; x <= cx + arcoW - 1; x++) pon(x, y, (x + y) % 2 === 0 ? PALETA.gris : PALETA.cespedOscuro);
    rect(cx - arcoW, ya, cx + arcoW - 1, yb);
  }
  return m;
}
