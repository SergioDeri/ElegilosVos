// Catálogo de Esquemas y Tabla de Equivalencias (ticket 02). Lógica pura.
import { CATALOGO, ESQUEMA_IDS, PUESTO_ARQUERO, type EsquemaId, type Esquema, type PuestoId } from "./catalogo";

export { ESQUEMA_IDS, PUESTO_IDS, PUESTO_ARQUERO } from "./catalogo";
export type { EsquemaId, Esquema, Puesto, PuestoId } from "./catalogo";

/** Esquema que se muestra cuando el Hincha todavía no eligió ninguno. Solo para mostrar: no cuenta como voto. */
export const esquemaPorDefecto: EsquemaId = "4-3-3";

/** Todos los Esquemas, en el orden fijo del catálogo (sirve también para desempatar). */
export function esquemas(): readonly Esquema[] {
  return ESQUEMA_IDS.map((id) => CATALOGO[id]);
}

export function esquema(id: EsquemaId): Esquema {
  return CATALOGO[id];
}

/** Valida un id que viene de afuera (base, URL, formulario). */
export function esEsquemaId(valor: string): valor is EsquemaId {
  return (ESQUEMA_IDS as readonly string[]).includes(valor);
}

/** ¿El Esquema tiene ese Puesto? Valida ids que vienen de afuera. */
export function esPuestoDe(esquemaId: EsquemaId, valor: string): valor is PuestoId {
  return CATALOGO[esquemaId].puestos.some((p) => p.id === valor);
}

/** El Puesto de arquero solo admite arqueros, y los arqueros solo van ahí. */
export function esPuestoDeArquero(puesto: PuestoId): boolean {
  return puesto === PUESTO_ARQUERO;
}

export { puestoEquivalente } from "./equivalencias";
