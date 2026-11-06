// Service worker de Elegilos Vos (ticket 15): solo notificaciones push (sin
// caché offline). El servidor manda un JSON { titulo, cuerpo, url, etiqueta }
// (MensajePush de src/domain/notificaciones). Al tocar la notificación se abre
// (o se enfoca) la app en esa ruta.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Solo rutas internas de la app ("/algo", nunca "//otro-sitio" ni URLs absolutas). */
function rutaSegura(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/";
}

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { cuerpo: event.data ? event.data.text() : "" };
  }
  const titulo = typeof datos.titulo === "string" && datos.titulo ? datos.titulo : "Elegilos Vos";
  const opciones = {
    body: typeof datos.cuerpo === "string" ? datos.cuerpo : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    lang: "es-UY",
    data: { url: rutaSegura(datos.url) },
  };
  if (typeof datos.etiqueta === "string" && datos.etiqueta) opciones.tag = datos.etiqueta;
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(rutaSegura(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const igual = ventanas.find((v) => v.url === destino);
      if (igual) return igual.focus();
      const deLaApp = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
      if (deLaApp) {
        await deLaApp.focus();
        return deLaApp.navigate(destino);
      }
      return self.clients.openWindow(destino);
    })(),
  );
});
