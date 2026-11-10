"use client";

// Marcas que se recuerdan en el dispositivo (localStorage), no en la base:
// "ya vio el aviso de la Selección", "descartó la invitación a elegir Club"
// (Selección, ticket 06). Se leen una vez por carga de página; en el servidor
// (y si localStorage no anda) cuentan como marcadas, así no se muestra nada
// que después desaparezca.
//
//   const aviso = crearMarcaDelDispositivo("elegilosvos:aviso-seleccion");
//   const marcada = aviso.useMarcada();   // en un componente
//   aviso.marcar();                       // la guarda y avisa a los componentes
//   aviso.guardar();                      // la guarda sin ocultar lo que ya se ve
import { useSyncExternalStore } from "react";

export type MarcaDelDispositivo = {
  useMarcada: () => boolean;
  marcar: () => void;
  guardar: () => void;
};

export function crearMarcaDelDispositivo(clave: string): MarcaDelDispositivo {
  let marcada: boolean | null = null;
  const oyentes = new Set<() => void>();

  function leer(): boolean {
    if (marcada === null) {
      try {
        marcada = localStorage.getItem(clave) !== null;
      } catch {
        marcada = true;
      }
    }
    return marcada;
  }

  function guardar() {
    try {
      localStorage.setItem(clave, new Date().toISOString());
    } catch {
      // Sin localStorage (modo privado estricto): no se recuerda.
    }
  }

  function suscribir(oyente: () => void) {
    oyentes.add(oyente);
    return () => oyentes.delete(oyente);
  }

  return {
    useMarcada: () => useSyncExternalStore(suscribir, leer, () => true),
    marcar() {
      guardar();
      marcada = true;
      for (const oyente of oyentes) oyente();
    },
    guardar,
  };
}
