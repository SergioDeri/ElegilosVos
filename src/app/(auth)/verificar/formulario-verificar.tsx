"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mensajeDeErrorAuth } from "@/lib/auth/mensajes";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { BotonReenviar } from "../_componentes/boton-reenviar";

export function FormularioVerificar({ emailInicial, reenviarYa }: { emailInicial: string; reenviarYa: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(emailInicial);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function verificar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const codigo = String(new FormData(evento.currentTarget).get("codigo") ?? "").trim();

    setCargando(true);
    setError(null);
    const { error } = await crearClienteNavegador().auth.verifyOtp({ email, token: codigo, type: "signup" });
    if (error) {
      setError(mensajeDeErrorAuth(error));
      setCargando(false);
      return;
    }
    // Con sesión: el layout de la app lo manda a elegir el Club Favorito.
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={verificar}>
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
          />
        </label>
        <label>
          Código
          <input
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={cargando}>
          Verificar
        </button>
      </form>
      <BotonReenviar
        esperaInicial={reenviarYa ? 0 : undefined}
        reenviar={() => crearClienteNavegador().auth.resend({ type: "signup", email })}
      />
    </>
  );
}
