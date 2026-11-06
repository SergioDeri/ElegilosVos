"use client";

// Reenvío de un código por email con espera visible. El límite real lo pone
// Supabase Auth (auth.email.max_frequency = 60s y auth.rate_limit.email_sent);
// esta espera solo evita clics inútiles.
import { useEffect, useState } from "react";
import { mensajeDeErrorAuth } from "@/lib/auth/mensajes";

const ESPERA_SEGUNDOS = 60;

export function BotonReenviar({
  reenviar,
  esperaInicial = ESPERA_SEGUNDOS,
}: {
  reenviar: () => Promise<{ error: { code?: string; status?: number } | null }>;
  esperaInicial?: number;
}) {
  const [restante, setRestante] = useState(esperaInicial);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (restante <= 0) return;
    const id = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [restante]);

  async function alClic() {
    setMensaje(null);
    const { error } = await reenviar();
    if (error) {
      setMensaje(mensajeDeErrorAuth(error));
    } else {
      setMensaje("Te mandamos un código nuevo.");
    }
    setRestante(ESPERA_SEGUNDOS);
  }

  return (
    <div>
      <button type="button" onClick={alClic} disabled={restante > 0}>
        {restante > 0 ? `Reenviar código (${restante} s)` : "Reenviar código"}
      </button>
      {mensaje && <p role="status">{mensaje}</p>}
    </div>
  );
}
