// Armado de la Alineación de la Selección (Selección, ticket 05): la misma
// cancha y los mismos Esquemas que en el Club, con los elegibles de la
// Selección. La Votación abre 14 días antes de cada Partido, así que en una
// fecha doble hay dos abiertas a la vez: el Hincha elige el Partido
// (`?partido=<id>`) y arma cada Alineación por separado. Sin Votación
// abierta, la cancha queda en solo lectura con el motivo. Si ya salió la
// Convocatoria del Partido (ticket 09), se marca a los convocados; los no
// convocados se siguen pudiendo elegir.
//
// Los resultados (11 Elegido y Gran Ausente final, ticket 10) están en
// /seleccion/resultados.
//
// Es la pantalla de cualquier Hincha, también del que no tiene Club Favorito
// (eligió "solo Selección", ticket 06): a ese, después de guardar su
// Alineación, se le invita a elegir Club.
//
// Compartir (ticket 12): el botón pide la imagen de "Mi 11" de la Selección
// del Partido en pantalla, como el armado del Club.
import Link from "next/link";
import { BotonCompartir } from "@/app/_compartir/boton-compartir";
import { aJson } from "@/domain/editor";
import { formatearHoraUy } from "@/domain/comun/horario";
import { NOMBRE_SELECCION } from "@/domain/comun/textos";
import { SELECCION } from "@/domain/comun/tipos";
import { requerirHinchada } from "@/lib/auth/sesion";
import { RUTA_SELECCION } from "@/lib/auth/rutas";
import { leerConvocados } from "@/lib/convocatoria/lecturas";
import { asegurarHerencia } from "@/lib/herencia/asegurar";
import { cargarAlineacion } from "../_alineacion/datos";
import { EditorAlineacion } from "../_alineacion/editor-alineacion";
import { AvisoNoDisponibles } from "../_herencia/aviso-no-disponibles";
import { EnlaceParcial } from "../parcial/enlace-parcial";
import { cargarPantallaDeLaSeleccion } from "../_partido/pantalla";
import { TarjetaPartido } from "../_partido/tarjeta-partido";
import { InvitacionElegirClub } from "../_seleccion/invitacion-elegir-club";

export default async function Seleccion({ searchParams }: PageProps<"/seleccion">) {
  const hincha = await requerirHinchada();
  const { partido: elegido } = await searchParams;
  const pantalla = await cargarPantallaDeLaSeleccion(typeof elegido === "string" ? elegido : undefined);
  const { votacion, partido, jugadores, opciones } = pantalla;

  if (!votacion || !partido) {
    return (
      <main>
        <h1>Selección</h1>
        <Link href={`${RUTA_SELECCION}/resultados`}>Ver el 11 Elegido y el historial</Link>
        <p role="status">
          Todavía no hay un próximo Partido de la Selección cargado. Cuando se cargue, vas a poder armar tu 11.
        </p>
      </main>
    );
  }

  // Herencia (ticket 07): al entrar, se materializa la de cada Votación abierta (no depender solo del cron).
  if (votacion.estado === "abierta") await asegurarHerencia(hincha.id, SELECCION, pantalla.ahora);
  const [alineacion, convocados] = await Promise.all([
    cargarAlineacion(pantalla.supabase, partido.id),
    leerConvocados(pantalla.supabase, partido.id),
  ]);

  return (
    <main>
      <h1>Selección</h1>
      <Link href={`${RUTA_SELECCION}/resultados`}>Ver el 11 Elegido y el historial</Link>
      {opciones.length > 1 && (
        <nav aria-label="Elegí el Partido">
          <p>Hay {opciones.length} Votaciones abiertas. Elegí para qué Partido armás tu 11:</p>
          <ul>
            {opciones.map((o) => (
              <li key={o.partido.id}>
                <Link
                  href={`${RUTA_SELECCION}?partido=${o.partido.id}`}
                  aria-current={o.partido.id === partido.id ? "page" : undefined}
                >
                  vs {o.partido.rival?.nombre ?? "Rival a confirmar"} ({formatearHoraUy(o.partido.inicio)})
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <TarjetaPartido pantalla={pantalla} partido={partido} votacion={votacion} />
      {votacion.estado === "abierta" && <EnlaceParcial href={`${RUTA_SELECCION}/parcial?partido=${partido.id}`} />}

      {votacion.estado === "abierta" && alineacion && <AvisoNoDisponibles alineacion={alineacion} jugadores={jugadores} />}
      {votacion.estado !== "anulada" && (
        <EditorAlineacion
          // Al cambiar de Partido o de estado (por ejemplo, al cerrar), el editor arranca de nuevo.
          key={`${partido.id}:${votacion.estado}`}
          partidoId={partido.id}
          club={SELECCION}
          inicial={alineacion ? aJson(alineacion) : null}
          jugadores={jugadores}
          editable={votacion.estado === "abierta"}
          convocados={convocados}
          conAlineacionGuardada={hincha.clubFavorito === null && <InvitacionElegirClub key="invitacion" />}
        />
      )}
      {votacion.estado !== "anulada" && (
        <BotonCompartir
          urlImagen={`/api/imagen/mi-alineacion/${partido.id}`}
          titulo={`Mi 11 para ${NOMBRE_SELECCION} vs ${partido.rival?.nombre ?? "Rival a confirmar"}`}
          sinImagen="Todavía no armaste tu Alineación para este Partido."
        />
      )}
    </main>
  );
}
