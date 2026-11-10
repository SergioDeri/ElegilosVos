// Muestra un Parcial (ticket 11): el 11 que va ganando sobre la cancha, los
// porcentajes por Esquema y los candidatos por Puesto. Lo usan la página del
// Hincha (en la cancha pixel, con Camisetas) y el backoffice (sin sprites:
// una tabla). Server Component: solo recibe datos agregados.
import type { ResultadoConteo } from "@/domain/conteo";
import { esquema } from "@/domain/esquemas";
import type { Destacado } from "@/domain/destacados";
import {
  formatearPorcentaje,
  vistaDelDestacado,
  vistaDelParcial,
  type JugadorEnVista,
  type JugadorParaMostrar,
  type VistaParcial as VistaDeDatos,
} from "@/domain/parcial";
import type { ClubOSeleccion } from "@/domain/comun/tipos";
import { CanchaDeLectura } from "@/app/_cancha/cancha-de-lectura";

function textoJugador(j: JugadorEnVista): string {
  return j.numero === null ? j.nombre : `${j.numero}. ${j.nombre}`;
}

export function VistaParcial(props: {
  resultado: ResultadoConteo;
  jugadores: readonly JugadorParaMostrar[];
  /** Texto si todavía no hay Alineaciones que cuenten. */
  textoVacio: string;
  /** Club (o Selección) de las Camisetas. Sin él (backoffice), el 11 va en una tabla, sin sprites. */
  club?: ClubOSeleccion;
  /** Solo el resumen y el 11 (el inicio): sin las tablas de Esquemas y candidatos. */
  soloElOnce?: boolean;
}) {
  const vista = vistaDelParcial(props.resultado, props.jugadores);
  if (vista.vacio) return <p role="status">{props.textoVacio}</p>;

  return (
    <div>
      <p>
        {vista.alineacionesQueCuentan === 1
          ? "1 Alineación cuenta"
          : `${vista.alineacionesQueCuentan} Alineaciones cuentan`}
        . Esquema que va ganando: <strong>{esquema(vista.esquemaGanador).nombre}</strong>.
      </p>

      <h3>El 11 que va ganando</h3>
      {props.club ? (
        <CanchaDeLectura
          club={props.club}
          esquema={vista.esquemaGanador}
          aria-label={`El 11 que va ganando en ${vista.esquemaGanador}`}
          puestos={Object.fromEntries(
            vista.once.map((p) => [
              p.puesto,
              {
                jugador: p.jugador,
                detalle: p.jugador && p.origen !== "vacante" ? formatearPorcentaje(p.porcentaje) : undefined,
                atenuado: p.origen === "vacante",
                descripcion: `${p.etiqueta}: ${p.jugador ? `${textoJugador(p.jugador)}, ${p.origen === "vacante" ? "sin votos" : formatearPorcentaje(p.porcentaje)}` : "sin Jugador"}`,
              },
            ]),
          )}
        />
      ) : (
        <table aria-label={`El 11 que va ganando en ${vista.esquemaGanador}`}>
          <thead>
            <tr>
              <th>Puesto</th>
              <th>Jugador</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {vista.once.map((p) => (
              <tr key={p.puesto}>
                <td>{p.etiqueta}</td>
                <td>{p.jugador ? textoJugador(p.jugador) : "—"}</td>
                <td>{p.jugador ? (p.origen === "vacante" ? "sin votos" : formatearPorcentaje(p.porcentaje)) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!props.soloElOnce && <DetalleDelParcial vista={vista} />}
    </div>
  );
}

function DetalleDelParcial({ vista }: { vista: Extract<VistaDeDatos, { vacio: false }> }) {
  return (
    <>
      <h3>Esquemas</h3>
      <table>
        <thead>
          <tr>
            <th>Esquema</th>
            <th>Alineaciones</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {vista.esquemas.map((e) => (
            <tr key={e.esquema} data-ganador={e.ganador}>
              <td>{e.ganador ? <strong>{e.esquema}</strong> : e.esquema}</td>
              <td>{e.votos}</td>
              <td>{formatearPorcentaje(e.porcentaje)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Candidatos por Puesto</h3>
      {vista.puestos.map((p) => (
        <section key={p.puesto} aria-label={p.etiqueta}>
          <h4>
            {p.etiqueta} ({p.totalVotos} {p.totalVotos === 1 ? "voto" : "votos"})
          </h4>
          {p.candidatos.length === 0 ? (
            <p>Sin votos válidos.</p>
          ) : (
            <ol>
              {p.candidatos.map((c, i) => (
                <li key={i}>
                  {textoJugador(c.jugador)}: {formatearPorcentaje(c.porcentaje)} ({c.votos})
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </>
  );
}

/**
 * El destacado del Parcial de la Selección (Selección, ticket 08): el Más
 * Pedido (o el Gran Ausente), con cuántas Alineaciones lo incluyen y su
 * porcentaje. Con empate, todos. Sin destacado, no muestra nada.
 */
export function VistaDestacado(props: {
  destacado: Destacado | null;
  jugadores: readonly JugadorParaMostrar[];
  /** Título en lugar del de su tipo (por ejemplo, "Gran Ausente final" en los resultados). */
  titulo?: string;
}) {
  const vista = vistaDelDestacado(props.destacado, props.jugadores);
  if (!vista) return null;
  const titulo = props.titulo ?? vista.titulo;
  return (
    <section aria-label={titulo}>
      <h3>{vista.jugadores.length === 1 ? titulo : `${titulo} (empate)`}</h3>
      <ul>
        {vista.jugadores.map((d, i) => (
          <li key={i}>
            <strong>{textoJugador(d.jugador)}</strong>: en {d.apariciones}{" "}
            {d.apariciones === 1 ? "Alineación" : "Alineaciones"} ({formatearPorcentaje(d.porcentaje)})
          </li>
        ))}
      </ul>
    </section>
  );
}
