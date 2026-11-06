// Enrolamiento o verificación del segundo factor (TOTP) del Admin.
import { redirect } from "next/navigation";
import { requerirCuentaAdmin } from "@/lib/auth/admin";
import { RUTA_ADMIN } from "@/lib/auth/acceso-admin";
import { DosFactores } from "./dos-factores";

export default async function PaginaDosFactores() {
  const { conDosFactores } = await requerirCuentaAdmin();
  if (conDosFactores) redirect(RUTA_ADMIN);
  return (
    <main>
      <h1>Verificación en dos pasos</h1>
      <DosFactores />
    </main>
  );
}
