// Muestra un Parcial (ticket 11): el 11 que va ganando sobre la cancha, los
// porcentajes por Esquema y los candidatos por Puesto. Lo usan la página del
// Hincha y el backoffice. Server Component: solo recibe datos agregados.
import type { ResultadoConteo } from "@/domain/conteo";
import { esquema } from "@/domain/esquemas";
import { formatearPorcentaje, vistaDelParcial, type JugadorEnVista, type JugadorParaMostrar } from "@/domain/parcial";
import { CLASE_PUESTO, CLASE_SIGLA, Cancha, posicionPuesto } from "@/app/_cancha/cancha";
import estilos from "./parcial.module.css";

function textoJugador(j: JugadorEnVista): string {
  return j.numero === null ? j.nombre : `${j.numero}. ${j.nombre}`;
}

export function VistaParcial(props: {
  resultado: ResultadoConteo;
  jugadores: readonly JugadorParaMostrar[];
  /** Texto si todavía no hay Alineaciones que cuenten. */
  textoVacio: string;
}) {
  const vista = vistaDelParcial(props.resultado, props.jugadores);
  if (vista.vacio) return <p role="status">{props.textoVacio}</p>;

  return (
    <div className={estilos.parcial}>
      <p>
        {vista.alineacionesQueCuentan === 1
          ? "1 Alineación cuenta"
          : `${vista.alineacionesQueCuentan} Alineaciones cuentan`}
        . Esquema que va ganando: <strong>{esquema(vista.esquemaGanador).nombre}</strong>.
      </p>

      <h3>El 11 que va ganando</h3>
      <Cancha role="list" aria-label={`El 11 que va ganando en ${vista.esquemaGanador}`}>
        {vista.once.map((p) => (
          <div
            key={p.puesto}
            role="listitem"
            className={`${CLASE_PUESTO} ${estilos.puesto}`}
            data-vacante={p.jugador === null}
            style={posicionPuesto(p)}
            aria-label={`${p.etiqueta}: ${p.jugador ? textoJugador(p.jugador) : "sin Jugador"}`}
          >
            <span className={CLASE_SIGLA}>{p.sigla}</span>
            <span>{p.jugador ? textoJugador(p.jugador) : "—"}</span>
            {p.jugador && <span>{p.origen === "vacante" ? "sin votos" : formatearPorcentaje(p.porcentaje)}</span>}
          </div>
        ))}
      </Cancha>

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
    </div>
  );
}
