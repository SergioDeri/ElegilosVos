"use client";

// Enrola (la primera vez) o verifica el factor TOTP del Admin desde el
// navegador: el cliente de Supabase guarda la sesión AAL2 resultante en las
// cookies y desde ahí el servidor y Postgres (`es_admin()`) la ven.
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { mensajeDeErrorAuth } from "@/lib/auth/mensajes";
import { RUTA_ADMIN } from "@/lib/auth/acceso-admin";
import { crearClienteNavegador } from "@/lib/supabase/client";

type Paso =
  | { tipo: "cargando" }
  | { tipo: "enrolar"; factorId: string; qr: string; secreto: string }
  | { tipo: "verificar"; factorId: string }
  | { tipo: "error"; mensaje: string };

async function prepararPaso(): Promise<Paso> {
  const supabase = crearClienteNavegador();
  const { data: factores, error } = await supabase.auth.mfa.listFactors();
  if (error) return { tipo: "error", mensaje: mensajeDeErrorAuth(error) };

  const verificado = factores.totp.find((f) => f.status === "verified");
  if (verificado) return { tipo: "verificar", factorId: verificado.id };

  // Limpia enrolamientos que quedaron a medias (QR generado pero sin verificar).
  for (const f of factores.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data: nuevo, error: errorEnrolar } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Backoffice Elegilos Vos",
  });
  if (errorEnrolar) return { tipo: "error", mensaje: mensajeDeErrorAuth(errorEnrolar) };
  return { tipo: "enrolar", factorId: nuevo.id, qr: nuevo.totp.qr_code, secreto: nuevo.totp.secret };
}

export function DosFactores() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>({ tipo: "cargando" });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    prepararPaso().then((p) => {
      if (vigente) setPaso(p);
    });
    return () => {
      vigente = false;
    };
  }, []);

  async function verificar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (paso.tipo !== "enrolar" && paso.tipo !== "verificar") return;
    const codigo = String(new FormData(evento.currentTarget).get("codigo") ?? "").replace(/\s/g, "");

    setEnviando(true);
    setError(null);
    const { error } = await crearClienteNavegador().auth.mfa.challengeAndVerify({
      factorId: paso.factorId,
      code: codigo,
    });
    if (error) {
      setError(error.code === "mfa_verification_failed" ? "El código no es correcto." : mensajeDeErrorAuth(error));
      setEnviando(false);
      return;
    }
    router.replace(RUTA_ADMIN);
    router.refresh();
  }

  if (paso.tipo === "cargando") return <p>Cargando…</p>;
  if (paso.tipo === "error") return <p role="alert">{paso.mensaje}</p>;

  return (
    <form onSubmit={verificar}>
      {paso.tipo === "enrolar" ? (
        <>
          <p>
            El backoffice exige verificación en dos pasos. Escaneá este código con tu app de autenticación (Google
            Authenticator, 1Password, Authy…) e ingresá el código de 6 dígitos que te muestra.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG en data URL que devuelve Supabase */}
          <img src={paso.qr} alt="Código QR para la app de autenticación" width={200} height={200} />
          <p>
            Si no podés escanearlo, cargá esta clave a mano: <code>{paso.secreto}</code>
          </p>
        </>
      ) : (
        <p>Ingresá el código de 6 dígitos de tu app de autenticación.</p>
      )}
      <label>
        Código
        <input
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          autoFocus
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={enviando}>
        Verificar
      </button>
    </form>
  );
}
