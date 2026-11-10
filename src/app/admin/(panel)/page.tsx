import Link from "next/link";

export default function InicioBackoffice() {
  return (
    <main>
      <h1>Backoffice</h1>
      <ul>
        <li>
          <Link href="/admin/planteles/penarol">Plantel de Peñarol</Link>
        </li>
        <li>
          <Link href="/admin/planteles/nacional">Plantel de Nacional</Link>
        </li>
        <li>
          <Link href="/admin/planteles/seleccion">Plantel de la Selección</Link>
        </li>
        <li>
          <Link href="/admin/partidos/penarol">Partidos de Peñarol</Link>
        </li>
        <li>
          <Link href="/admin/partidos/nacional">Partidos de Nacional</Link>
        </li>
        <li>
          <Link href="/admin/partidos/seleccion">Partidos de la Selección</Link>
        </li>
        <li>
          <Link href="/admin/convocatorias">Convocatorias de la Selección</Link>
        </li>
        <li>
          <Link href="/admin/clubes">Clubes: escudos</Link>
        </li>
        <li>
          <Link href="/admin/rivales">Rivales</Link>
        </li>
        <li>
          <Link href="/admin/votaciones">Votaciones: participación y Parcial</Link>
        </li>
        <li>
          <Link href="/admin/hinchas">Hinchas: cambiar el Club Favorito</Link>
        </li>
      </ul>
    </main>
  );
}
