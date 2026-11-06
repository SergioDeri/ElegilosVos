/** Primer valor de un parámetro de búsqueda de Next (puede venir repetido). */
export function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
