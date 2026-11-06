import Link from "next/link";
import { primero } from "../_componentes/parametros";
import { FormularioVerificar } from "./formulario-verificar";

export default async function PaginaVerificar({ searchParams }: PageProps<"/verificar">) {
  const parametros = await searchParams;
  const email = primero(parametros.email) ?? "";
  // Desde el login (cuenta sin verificar) puede que no haya un código reciente:
  // se permite reenviar enseguida.
  const desdeLogin = primero(parametros.desde) === "login";

  return (
    <main>
      <h1>Verificá tu email</h1>
      <p>Te mandamos un código de 6 dígitos{email ? ` a ${email}` : ""}. Ingresalo para activar tu cuenta.</p>
      <FormularioVerificar emailInicial={email} reenviarYa={desdeLogin} />
      <p>
        <Link href="/login">Volver al login</Link>
      </p>
    </main>
  );
}
