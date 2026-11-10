// Mi cuenta (ticket 13): datos del Hincha y borrado de cuenta.
// Organizada en secciones: "Tus datos", "Notificaciones" (ticket 15) y
// "Borrar cuenta". El Hincha sin Club Favorito (eligió "solo Selección",
// Selección ticket 06) lo puede elegir desde acá, una sola vez.
import Link from "next/link";
import { requerirHinchada } from "@/lib/auth/sesion";
import { RUTA_ELEGIR_CLUB, inicioDelHincha } from "@/lib/auth/rutas";
import { SeccionNotificaciones } from "./_notificaciones/seccion-notificaciones";
import { FormularioBorrarCuenta } from "./formulario-borrar-cuenta";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import estilos from "./cuenta.module.css";

export default async function PaginaCuenta() {
  const hincha = await requerirHinchada();

  return (
    <main>
      <p>
        <Link href={inicioDelHincha(hincha)}>← Volver</Link>
      </p>
      <h1>Mi cuenta</h1>

      <section aria-labelledby="seccion-datos" className={estilos.seccion}>
        <h2 id="seccion-datos">Tus datos</h2>
        <dl className={estilos.datos}>
          <dt>Email</dt>
          <dd>{hincha.email ?? "Sin email"}</dd>
          <dt>Club Favorito</dt>
          <dd>{hincha.clubFavorito ? NOMBRE_CLUB[hincha.clubFavorito] : "Todavía no elegiste (votás solo por la Selección)"}</dd>
        </dl>
        {hincha.clubFavorito ? (
          <p>Tu Club Favorito no se puede cambiar desde la app.</p>
        ) : (
          <p>
            Podés elegir tu Club Favorito cuando quieras, una sola vez: después no se puede cambiar.{" "}
            <Link href={RUTA_ELEGIR_CLUB} className="boton">
              Elegir mi Club
            </Link>
          </p>
        )}
      </section>

      <SeccionNotificaciones className={estilos.seccion} club={hincha.clubFavorito} />

      <section aria-labelledby="seccion-borrar" className={estilos.seccion}>
        <h2 id="seccion-borrar">Borrar cuenta</h2>
        {hincha.rol === "admin" ? (
          <p role="status">
            Sos Admin: tu cuenta no se puede borrar desde la app, para que el sistema no quede sin Admin. Si querés
            borrarla, primero alguien con acceso a la base tiene que quitarte el rol de Admin.
          </p>
        ) : (
          <FormularioBorrarCuenta email={hincha.email} />
        )}
      </section>
    </main>
  );
}
