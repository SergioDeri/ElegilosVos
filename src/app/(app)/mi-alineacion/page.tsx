// Armado de la Alineación del Hincha (ticket 09): el próximo Partido de su
// Club, la cuenta regresiva al cierre y el editor. Sin Votación abierta, la
// cancha queda en solo lectura con el motivo.
import Link from "next/link";
import { aJson } from "@/domain/editor";
import { requerirHincha } from "@/lib/auth/sesion";
import { asegurarHerencia } from "@/lib/herencia/asegurar";
import { BotonCompartir } from "@/app/_compartir/boton-compartir";
import { cargarAlineacion } from "../_alineacion/datos";
import { EditorAlineacion } from "../_alineacion/editor-alineacion";
import { AvisoNoDisponibles } from "../_herencia/aviso-no-disponibles";
import { cargarPartidoEnPantalla } from "../_partido/pantalla";
import { TarjetaPartido } from "../_partido/tarjeta-partido";

export default async function MiAlineacion() {
  const hincha = await requerirHincha();
  const pantalla = await cargarPartidoEnPantalla(hincha);
  const { club, votacion, partido, jugadores } = pantalla;

  if (!votacion || !partido) {
    return (
      <main>
        <p>
          <Link href="/">Volver al inicio</Link>
        </p>
        <h1>Mi Alineación</h1>
        <p role="status">Todavía no hay un próximo Partido de {club} cargado. Cuando se cargue, vas a poder armar tu 11.</p>
      </main>
    );
  }

  if (votacion.estado === "abierta") await asegurarHerencia(hincha.id, hincha.clubFavorito, pantalla.ahora);
  const alineacion = await cargarAlineacion(pantalla.supabase, partido.id);
  const rival = partido.rival?.nombre ?? "Rival a confirmar";

  return (
    <main>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
      <TarjetaPartido pantalla={pantalla} partido={partido} votacion={votacion} />

      {votacion.estado === "abierta" && alineacion && <AvisoNoDisponibles alineacion={alineacion} jugadores={jugadores} />}
      {votacion.estado !== "anulada" && (
        <EditorAlineacion
          // Al cambiar de Partido o de estado (por ejemplo, al cerrar), el editor arranca de nuevo.
          key={`${partido.id}:${votacion.estado}`}
          partidoId={partido.id}
          club={hincha.clubFavorito}
          inicial={alineacion ? aJson(alineacion) : null}
          jugadores={jugadores}
          editable={votacion.estado === "abierta"}
        />
      )}
      {votacion.estado !== "anulada" && (
        <BotonCompartir
          urlImagen={`/api/imagen/mi-alineacion/${partido.id}`}
          titulo={`Mi 11 para ${club} vs ${rival}`}
          sinImagen="Todavía no armaste tu Alineación para este Partido."
        />
      )}
    </main>
  );
}
