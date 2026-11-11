"use client";

// Recuperación en dos pasos, con código (no link):
//   1. Pide el email y manda el código (resetPasswordForEmail).
//   2. Verifica el código (verifyOtp tipo "recovery", que inicia sesión) y
//      guarda la contraseña nueva (updateUser).
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mensajeDeErrorAuth } from "@/lib/auth/mensajes";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { BotonReenviar } from "../(auth)/_componentes/boton-reenviar";
import { ContrasenaNueva, NO_COINCIDEN } from "../(auth)/_componentes/contrasena-nueva";

export function FormularioRecuperar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  // El código es de un solo uso: si ya se verificó y falló la contraseña,
  // el reintento solo vuelve a llamar a updateUser.
  const [codigoVerificado, setCodigoVerificado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function pedirCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    const { error } = await crearClienteNavegador().auth.resetPasswordForEmail(email);
    setCargando(false);
    if (error) {
      setError(mensajeDeErrorAuth(error));
      return;
    }
    // No se revela si el email tiene cuenta: siempre se pasa al paso 2.
    setCodigoEnviado(true);
  }

  async function cambiarContrasena(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const codigo = String(datos.get("codigo") ?? "").trim();
    const password = String(datos.get("password") ?? "");
    if (password !== String(datos.get("repetida") ?? "")) {
      setError(NO_COINCIDEN);
      return;
    }

    setCargando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    if (!codigoVerificado) {
      const verificacion = await supabase.auth.verifyOtp({ email, token: codigo, type: "recovery" });
      if (verificacion.error) {
        setError(mensajeDeErrorAuth(verificacion.error));
        setCargando(false);
        return;
      }
      setCodigoVerificado(true);
    }
    const cambio = await supabase.auth.updateUser({ password });
    if (cambio.error) {
      setError(mensajeDeErrorAuth(cambio.error));
      setCargando(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (!codigoEnviado) {
    return (
      <form onSubmit={pedirCodigo}>
        <p>Te vamos a mandar un código por email para elegir una contraseña nueva.</p>
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
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={cargando}>
          Mandarme el código
        </button>
      </form>
    );
  }

  return (
    <>
      <form onSubmit={cambiarContrasena}>
        <p>Si {email} tiene una cuenta, le llegó un código de 6 dígitos.</p>
        <label hidden={codigoVerificado}>
          Código
          <input
            name="codigo"
            disabled={codigoVerificado}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
        </label>
        <ContrasenaNueva etiqueta="Contraseña nueva" etiquetaRepetida="Repetí la contraseña nueva" />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={cargando}>
          Cambiar contraseña
        </button>
      </form>
      <BotonReenviar reenviar={() => crearClienteNavegador().auth.resetPasswordForEmail(email)} />
    </>
  );
}
