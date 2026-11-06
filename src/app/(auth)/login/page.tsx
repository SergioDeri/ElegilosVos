import Link from "next/link";
import { rutaSegura } from "@/lib/auth/rutas";
import { BotonGoogle } from "../_componentes/boton-google";
import { primero } from "../_componentes/parametros";
import { FormularioLogin } from "./formulario-login";

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const parametros = await searchParams;
  const next = rutaSegura(primero(parametros.next));
  const errorGoogle = primero(parametros.error) === "google";

  return (
    <main>
      <h1>Iniciar sesión</h1>
      {errorGoogle && <p role="alert">No se pudo entrar con Google. Probá de nuevo.</p>}
      <BotonGoogle next={next} />
      <p>o con tu email</p>
      <FormularioLogin next={next} />
      <p>
        <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
      </p>
      <p>
        ¿No tenés cuenta? <Link href="/registro">Registrate</Link>
      </p>
    </main>
  );
}
