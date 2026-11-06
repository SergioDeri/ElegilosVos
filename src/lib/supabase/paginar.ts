// Lectura paginada por `id` (keyset) para tablas que pueden pasar el límite
// de filas por pedido del servidor (`max_rows`, 1000 en Supabase).

/** Supabase devuelve como máximo 1000 filas por pedido (`max_rows`). */
export const TAMANO_DE_PAGINA = 1000;

/** Lo que se usa de una consulta de Supabase ya filtrada (PostgrestFilterBuilder). */
interface ConsultaPorId<F> extends PromiseLike<{ data: F[] | null; error: unknown }> {
  order(columna: "id"): ConsultaPorId<F>;
  limit(cantidad: number): ConsultaPorId<F>;
  gt(columna: "id", valor: string): ConsultaPorId<F>;
}

/**
 * Todas las filas de la consulta, de a `tamanoDePagina`, ordenadas por `id`.
 * `consulta()` arma la consulta filtrada (sin orden ni límite) y se llama una
 * vez por página: los builders de Supabase no se pueden reusar. No se saltea
 * ni repite filas aunque se inserten otras durante la lectura.
 */
export async function leerPorId<F extends { id: string }>(
  consulta: () => ConsultaPorId<F>,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
): Promise<F[]> {
  const filas: F[] = [];
  let ultimoId: string | null = null;
  for (;;) {
    let pagina = consulta().order("id").limit(tamanoDePagina);
    if (ultimoId !== null) pagina = pagina.gt("id", ultimoId);
    const { data, error } = await pagina;
    if (error) throw error;
    const leidas = data ?? [];
    filas.push(...leidas);
    if (leidas.length < tamanoDePagina) return filas;
    ultimoId = leidas[leidas.length - 1]!.id;
  }
}
