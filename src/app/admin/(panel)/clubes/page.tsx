// Clubes (diseño pixel art, ticket 07): el escudo de Peñarol, el de Nacional
// y el de la Selección (la AUF; el PNG está en assets/escudos/seleccion.png).
// El Admin lo sube o lo reemplaza; mientras no haya, se ve el hueco de "falta
// escudo".
import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CLUBES, SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import { nombreDeClubOSeleccion } from "@/domain/comun/textos";
import { Escudo } from "@/app/_pixel/escudo";
import { urlEscudo } from "@/lib/imagenes/subida";
import { FormularioEscudoDelClub } from "./formulario";

const CON_ESCUDO: ClubOSeleccion[] = [...CLUBES, SELECCION];

export default async function PaginaClubes() {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("club").select("id, escudo_path");
  if (error) throw error;
  const escudos = new Map(data.map((c) => [c.id, c.escudo_path]));

  return (
    <main>
      <h1>Clubes</h1>
      <p>El escudo de cada Club y el de la Selección es un PNG pixel art de exactamente 48x48.</p>
      {CON_ESCUDO.map((club) => {
        const path = escudos.get(club) ?? null;
        const nombre = nombreDeClubOSeleccion(club);
        return (
          <section key={club} aria-labelledby={`club-${club}`}>
            <h2 id={`club-${club}`}>{nombre}</h2>
            <Escudo nombre={nombre} url={urlEscudo(supabase, path)} />
            <FormularioEscudoDelClub club={club} tieneEscudo={path !== null} />
          </section>
        );
      })}
      <p>
        <Link href="/admin">Volver al backoffice</Link>
      </p>
    </main>
  );
}
