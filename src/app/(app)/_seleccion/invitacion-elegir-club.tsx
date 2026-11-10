"use client";

// Invitación a elegir Club para el Hincha sin Club Favorito (Selección,
// ticket 06): el editor la muestra cuando ya hay una Alineación de la
// Selección guardada. Se puede descartar (se recuerda en el dispositivo) y
// elegir Club más tarde desde Mi cuenta.
import Link from "next/link";
import { NOMBRE_CLUB, NOMBRE_SELECCION } from "@/domain/comun/textos";
import { crearMarcaDelDispositivo } from "@/app/_dispositivo/marca-del-dispositivo";
import { RUTA_ELEGIR_CLUB } from "@/lib/auth/rutas";
import estilos from "./avisos.module.css";

const descartada = crearMarcaDelDispositivo("elegilosvos:invitacion-elegir-club-descartada");

export function InvitacionElegirClub() {
  if (descartada.useMarcada()) return null;
  return (
    <section role="status" aria-label="Elegí tu Club" className={estilos.aviso}>
      <p>
        <strong>¡Guardaste tu 11!</strong> ¿Sos de {NOMBRE_CLUB.penarol} o de {NOMBRE_CLUB.nacional}? Elegí tu Club
        Favorito y armá también su Alineación (se elige una sola vez y no se cambia). Si no, seguí con la{" "}
        {NOMBRE_SELECCION}: lo podés elegir más tarde desde Mi cuenta.
      </p>
      <Link href={RUTA_ELEGIR_CLUB} className="boton">
        Elegir mi Club
      </Link>
      <button type="button" onClick={descartada.marcar}>
        Ahora no
      </button>
    </section>
  );
}
