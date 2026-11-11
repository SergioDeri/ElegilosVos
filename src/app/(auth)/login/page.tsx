import Link from "next/link";
import { rutaSegura } from "@/lib/auth/rutas";
import { BotonGoogle } from "../_componentes/boton-google";
import { primero } from "../_componentes/parametros";
import { QueEs } from "../_componentes/que-es";
import { FormularioLogin } from "./formulario-login";
import estilos from "./login.module.css";

const DONAR_PAYPAL = "https://www.paypal.com/donate/?hosted_button_id=U3EP35SY7MMCN";

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const parametros = await searchParams;
  const next = rutaSegura(primero(parametros.next));
  const errorGoogle = primero(parametros.error) === "google";

  return (
    <main>
      <h1>Iniciar sesión</h1>
      <QueEs />
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
      <p className={estilos.donar}>
        <a href={DONAR_PAYPAL} target="_blank" rel="noopener noreferrer">
          Donar con PayPal
        </a>
      </p>
    </main>
  );
}
