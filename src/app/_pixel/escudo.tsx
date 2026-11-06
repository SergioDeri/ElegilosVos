// Escudo de un Club o de un Rival: el PNG pixel art de 48x48 que subió el
// Admin, a 48 píxeles de arte y sin suavizado; o, si todavía no hay, el hueco
// pixelado de "falta escudo". Sin hooks: sirve en Server y Client Components.
import { faltaEscudo } from "@/domain/escudos";
import { LADO_ESCUDO } from "@/domain/planteles";
import { Sprite } from "./sprite";
import estilos from "./pixel.module.css";

const lado = `calc(${LADO_ESCUDO} * var(--u))`;

export function Escudo({ nombre, url, className }: { nombre: string; url: string | null; className?: string }) {
  const clase = className ? `${estilos.escudo} ${className}` : estilos.escudo;
  if (url) {
    // Los escudos son PNG de 48x48 ya validados: no hace falta next/image (no se optimizan ni redimensionan).
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={clase} src={url} alt={`Escudo de ${nombre}`} width={LADO_ESCUDO} height={LADO_ESCUDO} style={{ width: lado, height: lado }} />;
  }
  return (
    <span className={clase} role="img" aria-label={`Falta el escudo de ${nombre}`}>
      <Sprite matriz={faltaEscudo()} />
    </span>
  );
}
