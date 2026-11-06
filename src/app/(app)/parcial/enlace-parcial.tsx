// Link al Parcial desde la pantalla de armado (ticket 11).
import Link from "next/link";

export function EnlaceParcial() {
  return (
    <p>
      <Link href="/parcial">Ver el Parcial: el 11 que va ganando</Link>
    </p>
  );
}
