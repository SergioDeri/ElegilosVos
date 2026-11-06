// Web App Manifest (ticket 15): la web se instala como PWA. En iOS, las
// notificaciones push solo funcionan con la web agregada a la pantalla de inicio.
// Íconos placeholder: se rediseñan en la etapa de diseño.
import type { MetadataRoute } from "next";
import { PALETA, colorDeSistema } from "@/domain/pixel";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elegilos Vos",
    short_name: "Elegilos Vos",
    description: "Los hinchas de Peñarol y Nacional eligen el 11 de su Club.",
    lang: "es-UY",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Colores de la paleta: el tema neutro (el manifest es el mismo para todos).
    background_color: PALETA.fondo,
    theme_color: colorDeSistema("neutro"),
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
