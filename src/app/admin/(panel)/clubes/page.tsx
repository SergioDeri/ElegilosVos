// Clubes (diseño pixel art, ticket 07): el escudo de Peñarol y el de
// Nacional. El Admin lo sube o lo reemplaza; mientras no haya, se ve el hueco
// de "falta escudo".
import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CLUBES } from "@/domain/comun/tipos";
import { NOMBRE_CLUB } from "@/domain/comun/textos";
import { Escudo } from "@/app/_pixel/escudo";
import { urlEscudo } from "../_partidos/datos";
import { FormularioEscudoDelClub } from "./formulario";

export default async function PaginaClubes() {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("club").select("id, escudo_path");
  if (error) throw error;
  const escudos = new Map(data.map((c) => [c.id, c.escudo_path]));

  return (
    <main>
      <h1>Clubes</h1>
      <p>El escudo de cada Club es un PNG pixel art de exactamente 48x48.</p>
      {CLUBES.map((club) => {
        const path = escudos.get(club) ?? null;
        return (
          <section key={club} aria-labelledby={`club-${club}`}>
            <h2 id={`club-${club}`}>{NOMBRE_CLUB[club]}</h2>
            <Escudo nombre={NOMBRE_CLUB[club]} url={urlEscudo(supabase, path)} />
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
