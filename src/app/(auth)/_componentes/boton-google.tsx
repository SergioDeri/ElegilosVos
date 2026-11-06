"use client";

import { useState } from "react";
import { mensajeDeErrorAuth } from "@/lib/auth/mensajes";
import { crearClienteNavegador } from "@/lib/supabase/client";

/** Registro e inicio de sesión con Google (es lo mismo: si no existe, se crea). */
export function BotonGoogle({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrarConGoogle() {
    setCargando(true);
    setError(null);
    const vuelta = new URL("/auth/callback", window.location.origin);
    vuelta.searchParams.set("next", next);
    const { error } = await crearClienteNavegador().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: vuelta.toString() },
    });
    if (error) {
      setError(mensajeDeErrorAuth(error));
      setCargando(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={entrarConGoogle} disabled={cargando}>
        Continuar con Google
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
