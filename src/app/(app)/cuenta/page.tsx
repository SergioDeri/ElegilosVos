// Mi cuenta (ticket 13): datos del Hincha y borrado de cuenta.
// Organizada en secciones: "Tus datos", "Notificaciones" (ticket 15) y
// "Borrar cuenta".
import Link from "next/link";
import { requerirHincha } from "@/lib/auth/sesion";
import { RUTA_INICIO } from "@/lib/auth/rutas";
import { SeccionNotificaciones } from "./_notificaciones/seccion-notificaciones";
import { FormularioBorrarCuenta } from "./formulario-borrar-cuenta";
import { NOMBRE_CLUB } from "@/domain/comun/textos";

export default async function PaginaCuenta() {
  const hincha = await requerirHincha();

  return (
    <main>
      <p>
        <Link href={RUTA_INICIO}>← Volver</Link>
      </p>
      <h1>Mi cuenta</h1>

      <section aria-labelledby="seccion-datos">
        <h2 id="seccion-datos">Tus datos</h2>
        <dl>
          <dt>Email</dt>
          <dd>{hincha.email ?? "Sin email"}</dd>
          <dt>Club Favorito</dt>
          <dd>{NOMBRE_CLUB[hincha.clubFavorito]}</dd>
        </dl>
        <p>Tu Club Favorito no se puede cambiar desde la app.</p>
      </section>

      <SeccionNotificaciones />

      <section aria-labelledby="seccion-borrar">
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
