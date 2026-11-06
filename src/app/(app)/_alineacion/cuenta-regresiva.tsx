"use client";

// Cuenta regresiva hasta `hasta` (ISO). Al llegar a cero refresca la página:
// el servidor recalcula la Votación (por ejemplo, de abierta a cerrada).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { textoCuentaRegresiva } from "@/domain/armado";

export function CuentaRegresiva({ hasta }: { hasta: string }) {
  const router = useRouter();
  const objetivo = new Date(hasta).getTime();
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    let refrescado = false;
    const tic = () => {
      const ms = objetivo - Date.now();
      setRestante(ms);
      if (ms <= 0 && !refrescado) {
        refrescado = true;
        router.refresh();
      }
    };
    const primero = setTimeout(tic, 0);
    const intervalo = setInterval(tic, 1000);
    return () => {
      clearTimeout(primero);
      clearInterval(intervalo);
    };
  }, [objetivo, router]);

  return <span>{restante === null ? "…" : textoCuentaRegresiva(restante)}</span>;
}
