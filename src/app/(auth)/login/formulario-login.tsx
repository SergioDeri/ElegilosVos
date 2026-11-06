"use client";

// El login se hace desde el navegador (no desde una Server Action) para que
// el rate limit de Supabase Auth cuente por IP del Hincha y no por la del
// servidor.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mensajeDeErrorAuth } from "@/lib/auth/mensajes";
import { crearClienteNavegador } from "@/lib/supabase/client";

export function FormularioLogin({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const email = String(datos.get("email") ?? "").trim();
    const password = String(datos.get("password") ?? "");

    setCargando(true);
    setError(null);
    const { error } = await crearClienteNavegador().auth.signInWithPassword({ email, password });

    if (error?.code === "email_not_confirmed") {
      router.push(`/verificar?email=${encodeURIComponent(email)}&desde=login`);
      return;
    }
    if (error) {
      setError(mensajeDeErrorAuth(error));
      setCargando(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={entrar}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={cargando}>
        Entrar
      </button>
    </form>
  );
}
