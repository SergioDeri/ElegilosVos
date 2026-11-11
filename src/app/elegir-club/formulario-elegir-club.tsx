"use client";

import { useState, useTransition } from "react";
import { Escudo } from "@/app/_pixel/escudo";
import { NOMBRE_SELECCION } from "@/domain/comun/textos";
import { elegirClubFavorito, elegirSoloSeleccion } from "./acciones";
import estilos from "./elegir-club.module.css";

type Club = { id: string; nombre: string; escudo: string | null };
type Eleccion = { tipo: "club"; club: Club } | { tipo: "seleccion" };

/**
 * `seleccion`: la primera vez (registro) se ofrece también votar solo por la
 * Selección (Selección, ticket 06), como una opción más con su escudo; quien
 * ya la eligió y vuelve a elegir Club solo ve los Clubes (null).
 */
export function FormularioElegirClub({ clubes, seleccion }: { clubes: Club[]; seleccion: { escudo: string | null } | null }) {
  const [elegido, setElegido] = useState<Eleccion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function confirmar() {
    if (!elegido) return;
    setError(null);
    iniciar(async () => {
      const resultado = elegido.tipo === "club" ? await elegirClubFavorito(elegido.club.id) : await elegirSoloSeleccion();
      if (resultado?.error) setError(resultado.error);
    });
  }

  function volver() {
    setError(null);
    setElegido(null);
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
            <button
              key={club.id}
              type="button"
              data-club={club.id}
              className={estilos.club}
              onClick={() => setElegido({ tipo: "club", club })}
            >
              <Escudo nombre={club.nombre} url={club.escudo} />
              {club.nombre}
            </button>
          ))}
          {seleccion && (
            <button
              type="button"
              className={`${estilos.club} ${estilos.seleccion}`}
              onClick={() => setElegido({ tipo: "seleccion" })}
            >
              <Escudo nombre={NOMBRE_SELECCION} url={seleccion.escudo} />
              Solo la {NOMBRE_SELECCION}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (elegido.tipo === "seleccion") {
    return (
      <div role="alertdialog" aria-labelledby="confirmar-club" className={`${estilos.confirmar} ${estilos.seleccion}`}>
        <Escudo nombre={NOMBRE_SELECCION} url={seleccion?.escudo ?? null} className={estilos.escudoConfirmar} />
        <h2 id="confirmar-club">¿Votás solo por la {NOMBRE_SELECCION}?</h2>
        <p>
          <strong>Por ahora no vas a poder votar por ningún Club.</strong> No te quedás afuera: podés elegir tu Club
          más tarde desde Mi cuenta (una sola vez, como cualquier Hincha).
        </p>
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={confirmar} disabled={guardando}>
          Sí, solo la {NOMBRE_SELECCION}
        </button>
        <button type="button" className={estilos.volver} onClick={volver} disabled={guardando}>
          Volver
        </button>
      </div>
    );
  }

  const club = elegido.club;
  return (
    <div role="alertdialog" aria-labelledby="confirmar-club" data-club={club.id} className={estilos.confirmar}>
      <Escudo nombre={club.nombre} url={club.escudo} className={estilos.escudoConfirmar} />
      <h2 id="confirmar-club">¿Confirmás {club.nombre}?</h2>
      <p>
        <strong>Tu Club Favorito no se puede cambiar después.</strong> Solo vas a poder armar Alineaciones de{" "}
        {club.nombre}.
      </p>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={confirmar} disabled={guardando}>
        Sí, soy de {club.nombre}
      </button>
      <button type="button" className={estilos.volver} onClick={volver} disabled={guardando}>
        Volver
      </button>
    </div>
  );
}
