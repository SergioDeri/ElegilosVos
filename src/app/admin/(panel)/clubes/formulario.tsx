"use client";

import { useActionState } from "react";
import type { ClubOSeleccion } from "@/domain/comun/tipos";
import { CampoEscudo } from "../_componentes/campo-escudo";
import { cambiarEscudoDelClub, type EstadoEscudoClub } from "./acciones";

const INICIAL: EstadoEscudoClub = {};

export function FormularioEscudoDelClub({ club, tieneEscudo }: { club: ClubOSeleccion; tieneEscudo: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarEscudoDelClub.bind(null, club), INICIAL);
  return (
    <form action={accion}>
      <CampoEscudo error={estado.error} />
      {estado.mensaje && <p role={estado.ok ? "status" : "alert"}>{estado.mensaje}</p>}
      <button type="submit" disabled={enviando}>
        {tieneEscudo ? "Reemplazar escudo" : "Subir escudo"}
      </button>
    </form>
  );
}
