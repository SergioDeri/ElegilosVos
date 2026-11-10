"use client";

// Aviso de la Selección para Hinchas con Club (Selección, ticket 06): la
// primera vez que entran desde este dispositivo, les cuenta que ahora pueden
// votar a la Selección y los lleva ahí. Se marca como visto apenas aparece
// (localStorage: no se guarda en la base), así que en la próxima carga ya no
// está; mientras tanto se puede cerrar.
import Link from "next/link";
import { useEffect } from "react";
import { NOMBRE_SELECCION } from "@/domain/comun/textos";
import { crearMarcaDelDispositivo } from "@/app/_dispositivo/marca-del-dispositivo";
import { RUTA_SELECCION } from "@/lib/auth/rutas";
import estilos from "./avisos.module.css";

const visto = crearMarcaDelDispositivo("elegilosvos:aviso-seleccion-visto");

export function AvisoSeleccion() {
  const yaLoVio = visto.useMarcada();
  useEffect(() => {
    if (!yaLoVio) visto.guardar();
  }, [yaLoVio]);
  if (yaLoVio) return null;

  return (
    <section role="status" aria-label={`Novedad: la ${NOMBRE_SELECCION}`} className={`${estilos.aviso} ${estilos.fueraDelMarco}`}>
      <p>
        <strong>¡Novedad!</strong> Ahora también podés armar tu 11 de la {NOMBRE_SELECCION}, además del de tu Club.
      </p>
      <Link href={RUTA_SELECCION} className="boton" onClick={visto.marcar}>
        Votar la {NOMBRE_SELECCION}
      </Link>
      <button type="button" onClick={visto.marcar}>
        Cerrar
      </button>
    </section>
  );
}
