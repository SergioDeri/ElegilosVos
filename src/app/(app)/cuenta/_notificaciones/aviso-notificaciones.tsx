"use client";

// Aviso para activar las notificaciones, arriba de todo apenas se abre la app,
// mientras ESTE navegador no las tenga activadas. "Ahora no" lo oculta hasta
// la próxima vez que se abra la app (sessionStorage). No aparece si el
// navegador no soporta push, si el Hincha ya las bloqueó (eso se explica en
// Mi cuenta), en Mi cuenta (ahí está el control) o mientras se revisa el estado (no aparece y desaparece).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { activarPush, estadoPush, type EstadoPush } from "./push";
import estilos from "../../_seleccion/avisos.module.css";

const CLAVE_DESCARTADO = "elegilosvos:aviso-notificaciones-descartado";

function descartadoEnEstaVisita(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_DESCARTADO) !== null;
  } catch {
    return false;
  }
}

export function AvisoNotificaciones({ clavePublica }: { clavePublica: string }) {
  const enCuenta = usePathname() === "/cuenta";
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (descartadoEnEstaVisita()) return;
    let vigente = true;
    estadoPush(clavePublica)
      .catch(() => null)
      .then((e) => vigente && setEstado(e));
    return () => {
      vigente = false;
    };
  }, [clavePublica]);

  function descartar() {
    try {
      sessionStorage.setItem(CLAVE_DESCARTADO, new Date().toISOString());
    } catch {
      // Sin sessionStorage: se oculta solo en esta pantalla.
    }
    setEstado(null);
  }

  async function activar() {
    setOcupado(true);
    setError(null);
    const resultado = await activarPush(clavePublica);
    if ("error" in resultado) setError(resultado.error);
    else setEstado(resultado.estado);
    setOcupado(false);
  }

  if (enCuenta || (estado !== "desactivadas" && estado !== "ios_sin_instalar")) return null;

  return (
    <section aria-label="Activá las notificaciones" className={`${estilos.aviso} ${estilos.fueraDelMarco}`}>
      {estado === "desactivadas" ? (
        <p>
          <strong>Tenés las notificaciones apagadas.</strong> Activalas para enterarte cuando abre la Votación y cuando
          faltan 3 horas para el cierre.
        </p>
      ) : (
        <p>
          <strong>Tenés las notificaciones apagadas.</strong> En iPhone y iPad funcionan solo con Elegilos Vos agregada
          a la pantalla de inicio: mirá cómo en Mi cuenta.
        </p>
      )}
      {estado === "desactivadas" ? (
        <button type="button" className="boton" onClick={activar} disabled={ocupado}>
          Activar notificaciones
        </button>
      ) : (
        <Link href="/cuenta" className="boton" onClick={descartar}>
          Ver cómo
        </Link>
      )}
      <button type="button" onClick={descartar}>
        Ahora no
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
