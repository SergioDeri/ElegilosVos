"use client";

import { useState, useTransition } from "react";
import { Escudo } from "@/app/_pixel/escudo";
import { NOMBRE_SELECCION } from "@/domain/comun/textos";
import { elegirClubFavorito, elegirSoloSeleccion } from "./acciones";
import estilos from "./elegir-club.module.css";

type Club = { id: string; nombre: string; escudo: string | null };

/**
 * `ofrecerSoloSeleccion`: la primera vez (registro) se ofrece también "Quiero
 * votar solo por la Selección" (Selección, ticket 06); quien ya la eligió y
 * vuelve a elegir Club solo ve los Clubes.
 */
export function FormularioElegirClub({ clubes, ofrecerSoloSeleccion }: { clubes: Club[]; ofrecerSoloSeleccion: boolean }) {
  const [elegido, setElegido] = useState<Club | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function confirmar() {
    if (!elegido) return;
    setError(null);
    iniciar(async () => {
      const resultado = await elegirClubFavorito(elegido.id);
      if (resultado?.error) setError(resultado.error);
    });
  }

  function soloSeleccion() {
    setError(null);
    iniciar(async () => {
      const resultado = await elegirSoloSeleccion();
      if (resultado?.error) setError(resultado.error);
    });
  }

  if (!elegido) {
    return (
      <div>
        <p>
          Vas a armar la Alineación de tu Club Favorito, y también la de la {NOMBRE_SELECCION}. Una vez elegido, el
          Club no se puede cambiar.
        </p>
        <div className={estilos.clubes}>
          {clubes.map((club) => (
            // data-club: el botón toma los colores del Club (tema de @/domain/pixel).
            <button key={club.id} type="button" data-club={club.id} className={estilos.club} onClick={() => setElegido(club)}>
              <Escudo nombre={club.nombre} url={club.escudo} />
              {club.nombre}
            </button>
          ))}
        </div>
        {ofrecerSoloSeleccion && (
          <>
            <button type="button" onClick={soloSeleccion} disabled={guardando}>
              Quiero votar solo por la {NOMBRE_SELECCION}
            </button>
            <p>
              Si elegís votar solo por la {NOMBRE_SELECCION}, no te quedás afuera: podés elegir tu Club más tarde desde
              Mi cuenta (una sola vez, como cualquier Hincha).
            </p>
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div role="alertdialog" aria-labelledby="confirmar-club" data-club={elegido.id} className={estilos.confirmar}>
      <Escudo nombre={elegido.nombre} url={elegido.escudo} className={estilos.escudoConfirmar} />
      <h2 id="confirmar-club">¿Confirmás {elegido.nombre}?</h2>
      <p>
        <strong>Tu Club Favorito no se puede cambiar después.</strong> Solo vas a poder armar Alineaciones de{" "}
        {elegido.nombre}.
      </p>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={confirmar} disabled={guardando}>
        Sí, soy de {elegido.nombre}
      </button>
      <button type="button" className={estilos.volver} onClick={() => setElegido(null)} disabled={guardando}>
        Volver
      </button>
    </div>
  );
}
