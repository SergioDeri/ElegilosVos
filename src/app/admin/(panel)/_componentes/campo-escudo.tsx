// Campo de archivo para subir un escudo (de Club o de Rival). Las reglas
// (PNG de exactamente 48x48) las valida la Server Action con validarEscudo.
import { LADO_ESCUDO } from "@/domain/planteles";

export function CampoEscudo({ error }: { error?: string }) {
  return (
    <p>
      <label>
        Escudo (PNG pixel art de {LADO_ESCUDO}x{LADO_ESCUDO}) <input name="escudo" type="file" accept="image/png" />
      </label>
      {error && <span role="alert"> {error}</span>}
    </p>
  );
}
