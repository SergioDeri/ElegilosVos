// Página pública del 11 Elegido de un Partido (ticket 16): es el link que se
// comparte en redes. Sin sesión. Su metadata Open Graph apunta a la imagen
// generada en /api/imagen/once-elegido/<partidoId>. En la página, el 11 va en
// la cancha pixel con las Camisetas y los acentos del Club (ticket 04).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BotonCompartir } from "@/app/_compartir/boton-compartir";
import { CanchaDeLectura } from "@/app/_cancha/cancha-de-lectura";
import { TAMANO_IMAGEN } from "@/lib/compartir/imagen";
import { modeloOnceElegido } from "@/lib/compartir/datos";
import { crearClienteAdmin } from "@/lib/supabase/admin";

const cargar = cache((partidoId: string) => modeloOnceElegido(crearClienteAdmin(), partidoId));

const urlImagen = (partidoId: string) => `/api/imagen/once-elegido/${partidoId}`;

export async function generateMetadata({ params }: PageProps<"/compartir/once-elegido/[partidoId]">): Promise<Metadata> {
  const { partidoId } = await params;
  const modelo = await cargar(partidoId);
  if (!modelo) return { title: "Elegilos Vos" };
  const titulo = `${modelo.titulo}: ${modelo.partido}`;
  const descripcion = `${modelo.fecha} · Esquema ${modelo.esquema}. Armá tu 11 en Elegilos Vos.`;
  const imagen = { url: urlImagen(partidoId), ...TAMANO_IMAGEN, alt: modelo.alt, type: "image/png" };
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: titulo,
    description: descripcion,
    openGraph: { title: titulo, description: descripcion, type: "website", images: [imagen] },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion, images: [imagen] },
  };
}

export default async function PaginaOnceElegidoPublico({ params }: PageProps<"/compartir/once-elegido/[partidoId]">) {
  const { partidoId } = await params;
  const modelo = await cargar(partidoId);
  if (!modelo) notFound();

  return (
    <div data-club={modelo.clubId}>
      <main>
        <h1>{modelo.titulo}</h1>
        <h2>{modelo.partido}</h2>
        <p>
          {modelo.fecha} · Esquema {modelo.esquema}
        </p>
        <CanchaDeLectura
          club={modelo.clubId}
          esquema={modelo.esquemaId}
          aria-label={`${modelo.titulo} en ${modelo.esquema}`}
          puestos={Object.fromEntries(
            modelo.puestos.map((p) => [
              p.puesto,
              {
                jugador: p.nombre ? { nombre: p.nombre, numero: p.numero } : null,
                descripcion: `${p.sigla}: ${p.nombre ? `${p.numero}. ${p.nombre}` : "Vacante"}`,
              },
            ]),
          )}
        />
        <BotonCompartir
          urlImagen={urlImagen(partidoId)}
          enlace={`/compartir/once-elegido/${partidoId}`}
          titulo={`${modelo.titulo}: ${modelo.partido}`}
        />
        <p>
          <Link href="/">Armá tu 11 en Elegilos Vos</Link>
        </p>
      </main>
    </div>
  );
}
