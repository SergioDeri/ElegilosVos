import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { colorDeSistema, cssDeLaGrilla, cssDeLaPaleta } from "@/domain/pixel";
import { RegistrarServiceWorker } from "./_pwa/registrar-service-worker";
import "./pixel.css";

// Fuentes bitmap (OFL-1.1), servidas por la app. Se usan solo en múltiplos
// enteros de su tamaño nativo: Press Start 2P de 8 px, Tiny5 de 10 px.
const fuenteTitulos = localFont({
  src: "../../node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2",
  variable: "--fuente-titulos",
  display: "swap",
});
const fuenteCuerpo = localFont({
  src: "../../node_modules/@fontsource/tiny5/files/tiny5-latin-400-normal.woff2",
  variable: "--fuente-cuerpo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Elegilos Vos",
  description: "Los hinchas de Peñarol y Nacional eligen el 11 de su Club.",
  // PWA (ticket 15): ícono y modo standalone en iOS.
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Elegilos Vos", statusBarStyle: "default" },
};

// Sin Club Favorito todavía: tema neutro. El layout de (app) lo pisa con el del Club.
export const viewport: Viewport = { themeColor: colorDeSistema("neutro") };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-UY" className={`${fuenteTitulos.variable} ${fuenteCuerpo.variable}`}>
      <head>
        {/* Paleta, temas y --px salen de @/domain/pixel: única fuente de colores y de la grilla. */}
        <style>{`${cssDeLaPaleta()}\n${cssDeLaGrilla()}`}</style>
      </head>
      <body>
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
