"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mensajeDeErrorAuth } from "@/lib/auth/mensajes";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { ContrasenaNueva, NO_COINCIDEN } from "../_componentes/contrasena-nueva";

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
      setError(NO_COINCIDEN);
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
      <ContrasenaNueva etiqueta="Contraseña" etiquetaRepetida="Repetí la contraseña" />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={cargando}>
        Crear cuenta
      </button>
    </form>
  );
}
