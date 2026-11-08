"use client";

// Cancha pixel de solo lectura (ticket 04): el Parcial, el 11 Elegido y el
// link público. Recibe datos serializables desde Server Components y los
// dibuja en CanchaPixel: Camiseta, número y apellido por Puesto, con un
// detalle opcional (por ejemplo, el porcentaje) en una chapita.
import type { ClubId } from "@/domain/comun/tipos";
import { esPuestoDeArquero, type EsquemaId, type PuestoId } from "@/domain/esquemas";
import { JugadorConCamiseta } from "@/app/_pixel/jugador-con-camiseta";
import { CanchaPixel } from "./cancha-pixel";
import { PuestoLibre } from "./puesto-libre";
import estilos from "./cancha-de-lectura.module.css";

export interface PuestoDeLectura {
  /** null: Puesto vacante. */
  jugador: { nombre: string; numero: number | null } | null;
  /** Texto corto sobre la Camiseta (porcentaje, "sin votos"...). */
  detalle?: string;
  /** Resaltado (por ejemplo, un Jugador que también está en tu Alineación). */
  destacado?: boolean;
  /** Atenuado (por ejemplo, un Puesto completado sin votos). */
  atenuado?: boolean;
  /** Nombre accesible del Puesto. */
  descripcion: string;
}

export function CanchaDeLectura(props: {
  club: ClubId;
  esquema: EsquemaId;
  puestos: Partial<Record<PuestoId, PuestoDeLectura>>;
  "aria-label": string;
}) {
  const { club, esquema, puestos } = props;
  return (
    <div className={estilos.contenedor}>
      <CanchaPixel
        esquema={esquema}
        role="list"
        aria-label={props["aria-label"]}
        puesto={(caja) => {
          const p = puestos[caja.id];
          const jugador = p?.jugador;
          return (
            <div
              role="listitem"
              aria-label={p?.descripcion ?? `${caja.etiqueta}: vacante`}
              className={estilos.puesto}
              data-destacado={!!p?.destacado}
              data-atenuado={!!p?.atenuado}
            >
              {jugador ? (
                <JugadorConCamiseta
                  club={club}
                  // En la cancha, el Puesto de arquero solo lo ocupa un arquero.
                  jugador={{ nombre: jugador.nombre, numero: jugador.numero, posicionNatural: esPuestoDeArquero(caja.id) ? "ARQ" : "DEF" }}
                  ancho={caja.ancho}
                />
              ) : (
                <PuestoLibre texto={caja.sigla} ancho={caja.ancho} />
              )}
              {p?.detalle && <span className={estilos.detalle}>{p.detalle}</span>}
            </div>
          );
        }}
      />
    </div>
  );
}
