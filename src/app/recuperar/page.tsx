import Link from "next/link";
import { FormularioRecuperar } from "./formulario-recuperar";

// Accesible con o sin sesión: después de verificar el código de recuperación
// el Hincha queda con sesión y elige la contraseña nueva en esta misma página.
export default function PaginaRecuperar() {
  return (
    <main>
      <h1>Recuperar contraseña</h1>
      <FormularioRecuperar />
      <p>
        <Link href="/login">Volver al login</Link>
      </p>
    </main>
  );
}
