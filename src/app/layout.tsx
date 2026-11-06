import type { Metadata, Viewport } from "next";
import { RegistrarServiceWorker } from "./_pwa/registrar-service-worker";

export const metadata: Metadata = {
  title: "Elegilos Vos",
  description: "Los hinchas de Peñarol y Nacional eligen el 11 de su Club.",
  // PWA (ticket 15): ícono y modo standalone en iOS.
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Elegilos Vos", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#156534" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-UY">
      <body>
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
