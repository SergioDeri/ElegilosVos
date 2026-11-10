// Link al Parcial desde la pantalla de armado (ticket 11). En la Selección,
// al Parcial de su Partido (`/seleccion/parcial?partido=<id>`).
import Link from "next/link";

export function EnlaceParcial({ href = "/parcial" }: { href?: string }) {
  return (
    <p>
      <Link href={href}>Ver el Parcial: el 11 que va ganando</Link>
    </p>
  );
}
