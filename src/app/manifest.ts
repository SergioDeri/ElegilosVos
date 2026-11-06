// Web App Manifest (ticket 15): la web se instala como PWA. En iOS, las
// notificaciones push solo funcionan con la web agregada a la pantalla de inicio.
// Íconos placeholder: se rediseñan en la etapa de diseño.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elegilos Vos",
    short_name: "Elegilos Vos",
    description: "Los hinchas de Peñarol y Nacional eligen el 11 de su Club.",
    lang: "es-UY",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#156534",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
