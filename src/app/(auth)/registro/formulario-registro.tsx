"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mensajeDeErrorAuth } from "@/lib/auth/mensajes";
import { crearClienteNavegador } from "@/lib/supabase/client";

const LARGO_MINIMO = 8; // igual a auth.minimum_password_length (supabase/config.toml)

export function FormularioRegistro() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function registrarse(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const email = String(datos.get("email") ?? "").trim();
    const password = String(datos.get("password") ?? "");
    const repetida = String(datos.get("repetida") ?? "");

    if (password !== repetida) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    setError(null);
    // Con la confirmación de email activada no hay sesión hasta verificar el
    // código. Si el email ya existe, Supabase responde igual (no revela
    // cuentas): el Hincha va a verificar y, si ya estaba verificado, inicia sesión.
    const { error } = await crearClienteNavegador().auth.signUp({ email, password });
    if (error) {
      setError(mensajeDeErrorAuth(error));
      setCargando(false);
      return;
    }
    router.push(`/verificar?email=${encodeURIComponent(email)}`);
  }

  return (
    <form onSubmit={registrarse}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Contraseña (mínimo {LARGO_MINIMO} caracteres)
        <input name="password" type="password" autoComplete="new-password" minLength={LARGO_MINIMO} required />
      </label>
      <label>
        Repetí la contraseña
        <input name="repetida" type="password" autoComplete="new-password" minLength={LARGO_MINIMO} required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={cargando}>
        Crear cuenta
      </button>
    </form>
  );
}
