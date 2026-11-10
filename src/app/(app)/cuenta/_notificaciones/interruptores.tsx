"use client";

// Interruptores "mi club" y "Selección" (Selección, ticket 13). Valen para
// todos los dispositivos del Hincha: se guardan en la base al cambiarlos.
import { useState } from "react";
import type { Interruptor, PreferenciasDeNotificacion } from "@/domain/notificaciones";
import { cambiarPreferencia } from "./acciones";

const ROTULO: Record<Interruptor, string> = {
  miClub: "Avisos de mi club",
  seleccion: "Avisos de la Selección",
};

export function Interruptores({
  visibles,
  iniciales,
}: {
  visibles: readonly Interruptor[];
  iniciales: PreferenciasDeNotificacion;
}) {
  const [preferencias, setPreferencias] = useState(iniciales);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(interruptor: Interruptor, prendido: boolean) {
    const anteriores = preferencias;
    setPreferencias({ ...preferencias, [interruptor]: prendido });
    setOcupado(true);
    setError(null);
    const resultado = await cambiarPreferencia(interruptor, prendido).catch(() => null);
    if (!resultado?.ok) {
      setPreferencias(anteriores);
      setError(resultado?.error ?? "No se pudo guardar el cambio. Probá de nuevo.");
    }
    setOcupado(false);
  }

  return (
    <fieldset>
      <legend>Qué avisos querés recibir</legend>
      {visibles.map((interruptor) => (
        <p key={interruptor}>
          <label>
            <input
              type="checkbox"
              checked={preferencias[interruptor]}
              disabled={ocupado}
              onChange={(e) => cambiar(interruptor, e.target.checked)}
            />{" "}
            {ROTULO[interruptor]}
          </label>
        </p>
      ))}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
