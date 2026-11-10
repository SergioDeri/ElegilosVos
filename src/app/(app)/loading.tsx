// Pantalla de carga de la app del Hincha: aparece apenas se toca un enlace,
// mientras el servidor arma la página (que consulta Supabase). Sin esto, la
// navegación no muestra nada hasta tener la página entera.
import estilos from "./loading.module.css";

export default function Cargando() {
  return (
    <main aria-busy="true">
      <p role="status" className={estilos.cargando}>
        Cargando
      </p>
    </main>
  );
}
