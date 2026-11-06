"use client";

import { useState, useTransition } from "react";
import { elegirClubFavorito } from "./acciones";

type Club = { id: string; nombre: string };

export function FormularioElegirClub({ clubes }: { clubes: Club[] }) {
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

  if (!elegido) {
    return (
      <div>
        <p>Vas a armar la Alineación de tu Club Favorito. Una vez elegido, no se puede cambiar.</p>
        {clubes.map((club) => (
          <button key={club.id} type="button" onClick={() => setElegido(club)}>
            {club.nombre}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div role="alertdialog" aria-labelledby="confirmar-club">
      <h2 id="confirmar-club">¿Confirmás {elegido.nombre}?</h2>
      <p>
        <strong>Tu Club Favorito no se puede cambiar después.</strong> Solo vas a poder armar Alineaciones de{" "}
        {elegido.nombre}.
      </p>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={confirmar} disabled={guardando}>
        Sí, soy de {elegido.nombre}
      </button>
      <button type="button" onClick={() => setElegido(null)} disabled={guardando}>
        Volver
      </button>
    </div>
  );
}
