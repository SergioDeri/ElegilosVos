"use client";

import { useActionState, useState } from "react";
import { confirmaBorrado, confirmacionDeBorrado } from "@/domain/cuenta";
import { borrarMiCuenta, type EstadoBorrado } from "./acciones";

export function FormularioBorrarCuenta({ email }: { email: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [escrito, setEscrito] = useState("");
  const [estado, accion, borrando] = useActionState<EstadoBorrado, FormData>(borrarMiCuenta, null);
  const esperado = confirmacionDeBorrado(email);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}>
        Borrar mi cuenta
      </button>
    );
  }

  return (
    <form action={accion} role="alertdialog" aria-labelledby="confirmar-borrado" aria-describedby="detalle-borrado">
      <h3 id="confirmar-borrado">¿Borrar tu cuenta para siempre?</h3>
      <p id="detalle-borrado">
        <strong>No se puede deshacer.</strong> Se borran tu cuenta, tu Club Favorito y todas tus Alineaciones. Si hay
        una Votación abierta, tu Alineación deja de contar. Los 11 Elegidos que ya cerraron no cambian.
      </p>
      <label>
        Para confirmar, escribí <strong>{esperado}</strong>:{" "}
        <input
          name="confirmacion"
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          required
        />
      </label>
      {estado?.error && <p role="alert">{estado.error}</p>}
      <button type="submit" disabled={borrando || !confirmaBorrado(escrito, email)}>
        {borrando ? "Borrando…" : "Borrar mi cuenta para siempre"}
      </button>
      <button
        type="button"
        disabled={borrando}
        onClick={() => {
          setAbierto(false);
          setEscrito("");
        }}
      >
        Cancelar
      </button>
    </form>
  );
}
