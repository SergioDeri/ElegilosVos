"use client";
// Botón "Compartir" (ticket 16): pide la imagen generada en el servidor y la
// comparte con la Web Share API (con archivo) si el navegador puede; si no, la
// descarga y, si hay un link público, lo copia al portapapeles.
import { useState } from "react";

const NOMBRE_POR_DEFECTO = "elegilos-vos.png";

function nombreDeArchivo(respuesta: Response): string {
  const disposicion = respuesta.headers.get("Content-Disposition") ?? "";
  return /filename="([^"]+)"/.exec(disposicion)?.[1] ?? NOMBRE_POR_DEFECTO;
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BotonCompartir(props: {
  /** Ruta de la imagen (route handler de /api/imagen/...). */
  urlImagen: string;
  /** Texto que acompaña la imagen al compartir. */
  titulo: string;
  /** Ruta pública para compartir como link (solo el 11 Elegido). */
  enlace?: string;
  /** Mensaje si la imagen no existe (404). */
  sinImagen?: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function compartir() {
    setOcupado(true);
    setMensaje(null);
    try {
      const respuesta = await fetch(props.urlImagen, { cache: "no-store" });
      if (respuesta.status === 404) {
        setMensaje(props.sinImagen ?? "No hay imagen para compartir.");
        return;
      }
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const blob = await respuesta.blob();
      const nombre = nombreDeArchivo(respuesta);
      const archivo = new File([blob], nombre, { type: blob.type || "image/png" });
      const link = props.enlace ? new URL(props.enlace, window.location.origin).href : null;
      const texto = link ? `${props.titulo} ${link}` : props.titulo;

      if (navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: props.titulo, text: texto });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return; // lo canceló el Hincha
          // Si falló por otro motivo, sigue con la descarga.
        }
      }

      descargar(blob, nombre);
      if (!link) {
        setMensaje("Descargamos la imagen.");
        return;
      }
      try {
        await navigator.clipboard.writeText(link);
        setMensaje("Descargamos la imagen y copiamos el link.");
      } catch {
        setMensaje(`Descargamos la imagen. Link para compartir: ${link}`);
      }
    } catch {
      setMensaje("No se pudo generar la imagen. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <p>
      <button type="button" onClick={compartir} disabled={ocupado}>
        {ocupado ? "Generando imagen..." : "Compartir"}
      </button>
      {mensaje && <span role="status"> {mensaje}</span>}
    </p>
  );
}
