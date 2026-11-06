// Ícono 8x8 de @/domain/pixel alineado con el texto de cuerpo. Toma el color
// del texto que lo rodea (`currentColor`, que siempre es un color de la
// paleta), así acompaña al acento del tema en botones y avisos. Es decorativo:
// el texto de al lado dice lo mismo.
import { icono, type NombreIcono } from "@/domain/pixel";
import { Sprite } from "./sprite";
import estilos from "./icono.module.css";

export function Icono({ nombre }: { nombre: NombreIcono }) {
  return <Sprite matriz={icono(nombre, "cal")} className={estilos.icono} style={{ display: "inline-block" }} />;
}
