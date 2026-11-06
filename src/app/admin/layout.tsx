// Backoffice. Solo cuentas con rol Admin (si no, 404); sin sesión, al login.
// El panel (admin/(panel)) exige además 2FA en la sesión (AAL2). Este layout
// NO protege las Server Actions: cada una llama a requerirAdminEnAccion().
import Link from "next/link";
import { requerirCuentaAdmin } from "@/lib/auth/admin";
import { BotonCerrarSesion } from "@/app/_sesion/boton-cerrar-sesion";

export const metadata = { title: "Backoffice · Elegilos Vos", robots: { index: false } };

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const { hincha, conDosFactores } = await requerirCuentaAdmin();
  return (
    <>
      <header>
        <strong>Backoffice</strong> · {hincha.email}
        {conDosFactores && (
          <nav>
            <Link href="/admin">Inicio</Link> · <Link href="/admin/planteles/penarol">Plantel de Peñarol</Link> ·{" "}
            <Link href="/admin/planteles/nacional">Plantel de Nacional</Link> · <Link href="/admin/hinchas">Hinchas</Link> ·{" "}
            <Link href="/">Volver a la app</Link>
          </nav>
        )}
        <BotonCerrarSesion />
      </header>
      {children}
    </>
  );
}
