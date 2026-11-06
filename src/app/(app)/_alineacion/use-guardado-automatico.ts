"use client";

// Hook de guardado automático de la Alineación (ver guardador.ts).
import { useEffect, useState } from "react";
import { aJson, type Alineacion } from "@/domain/editor";
import { guardarAlineacion } from "./acciones";
import { crearGuardador, type EstadoGuardado } from "./guardador";

export type { EstadoGuardado };

export function useGuardadoAutomatico(partidoId: string) {
  const [estado, setEstado] = useState<EstadoGuardado>({ tipo: "guardado" });
  const [guardador] = useState(() =>
    crearGuardador<Alineacion>({
      guardar: (alineacion) => guardarAlineacion(partidoId, aJson(alineacion)),
      alCambiarEstado: setEstado,
    }),
  );

  useEffect(() => () => guardador.destruir(), [guardador]);

  // Avisar antes de salir si hay cambios sin guardar.
  const sinGuardar = estado.tipo === "pendiente" || estado.tipo === "guardando" || estado.tipo === "error";
  useEffect(() => {
    if (!sinGuardar) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sinGuardar]);

  return { estado, programar: guardador.programar, reintentar: guardador.reintentar };
}
