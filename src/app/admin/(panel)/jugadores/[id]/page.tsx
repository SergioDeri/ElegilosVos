// Ficha de un Jugador (de un Club o de la Selección) en el backoffice: datos,
// Disponibilidad y baja. Los de la Selección no llevan número.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esClubOSeleccion } from "@/domain/comun/tipos";
import { nombreEnElPlantel } from "@/domain/planteles";
import { deClubOSeleccion } from "../../../_comun/etiquetas";
import { cambiarEnPlantel } from "../../acciones";
import { FormularioDatos, FormularioDisponibilidad } from "../../_componentes/formularios";
import { esUuid } from "@/domain/comun/ids";

export default async function PaginaJugador({ params }: PageProps<"/admin/jugadores/[id]">) {
  await requerirAdmin();
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const supabase = await crearClienteServidor();
  const { data: jugador, error } = await supabase.from("jugador").select().eq("id", id).maybeSingle();
  if (error) throw error;
  if (!jugador || !esClubOSeleccion(jugador.club_id)) notFound();

  return (
    <main>
      <h1>{nombreEnElPlantel(jugador)}</h1>
      <p>
        Plantel {deClubOSeleccion(jugador.club_id)} ·{" "}
        {jugador.en_plantel ? "En el Plantel" : "Dado de baja (no se puede elegir en las Alineaciones)"}
      </p>

      <h2>Datos</h2>
      <FormularioDatos id={jugador.id} nombre={jugador.nombre} numero={jugador.numero} posicionNatural={jugador.posicion_natural} />

      <h2>Disponibilidad</h2>
      <p>Cada cambio de Disponibilidad queda registrado para avisar a los Hinchas.</p>
      <FormularioDisponibilidad id={jugador.id} disponibilidad={jugador.disponibilidad} motivo={jugador.motivo_disponibilidad} />

      <h2>Plantel</h2>
      <form action={cambiarEnPlantel.bind(null, jugador.id, !jugador.en_plantel)}>
        <button type="submit">{jugador.en_plantel ? "Dar de baja del Plantel" : "Reincorporar al Plantel"}</button>
      </form>

      <p>
        <Link href={`/admin/planteles/${jugador.club_id}`}>Volver al Plantel</Link>
      </p>
    </main>
  );
}
