import Link from "next/link";
import { BotonGoogle } from "../_componentes/boton-google";
import { FormularioRegistro } from "./formulario-registro";

export default function PaginaRegistro() {
  return (
    <main>
      <h1>Crear cuenta</h1>
      <BotonGoogle next="/" />
      <p>o con tu email</p>
      <FormularioRegistro />
      <p>
        ¿Ya tenés cuenta? <Link href="/login">Iniciá sesión</Link>
      </p>
    </main>
  );
}
