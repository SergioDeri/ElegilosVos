// Panel del backoffice: exige Admin con 2FA verificado en la sesión (AAL2).
// Sin 2FA, al enrolamiento/verificación. Las Server Actions se verifican aparte.
import { requerirAdmin } from "@/lib/auth/admin";

export default async function LayoutPanel({ children }: LayoutProps<"/admin">) {
  await requerirAdmin();
  return <>{children}</>;
}
