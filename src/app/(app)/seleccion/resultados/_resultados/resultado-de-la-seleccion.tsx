// Resultado de una Votación de la Selección (Selección, ticket 10): el Gran
// Ausente final destacado (si ya hay Convocatoria y algún no convocado figura)
// y el 11 Elegido con la vista de los Clubes (nombre completo, sin número,
// Camisetas de la Selección), el 11 Real y las Coincidencias de la Alineación
// del Hincha (ticket 11), con el botón de compartir (ticket 12).
import { VistaDestacado } from "@/app/_parcial/vista-parcial";
import { SELECCION } from "@/domain/comun/tipos";
import type { Destacado } from "@/domain/destacados";
import type { JugadorResultado, PartidoResultado, ResultadoVista } from "../../../resultados/_resultados/datos";
import { VistaResultado } from "../../../resultados/_resultados/vista-resultado";

export function ResultadoDeLaSeleccion(props: {
  partido: PartidoResultado;
  resultado: ResultadoVista | null;
  jugadores: Map<string, JugadorResultado>;
  granAusente: Destacado | null;
  /** Ids de la Alineación del Hincha para el Partido, o null si no armó. */
  misJugadores: string[] | null;
  /** Ids del 11 Real, o null si el Admin no lo cargó. */
  onceReal: string[] | null;
}) {
  const jugadores = [...props.jugadores].map(([id, j]) => ({ id, nombre: j.nombre, numero: j.numero }));
  return (
    <>
      <VistaDestacado destacado={props.granAusente} jugadores={jugadores} titulo="Gran Ausente final" />
      <VistaResultado
        club={SELECCION}
        partido={props.partido}
        resultado={props.resultado}
        jugadores={props.jugadores}
        misJugadores={props.misJugadores}
        onceReal={props.onceReal}
      />
    </>
  );
}
