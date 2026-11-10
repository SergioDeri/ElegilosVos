// Dibujo de la imagen para compartir (ticket 16) a partir del modelo de
// @/domain/compartir. Diseño provisorio: lo rehace la etapa de diseño.
// Satori (next/og) solo entiende flexbox y posiciones absolutas.
//
// En la Selección (Selección, ticket 12) la imagen suma el escudo arriba a la
// derecha, el destacado del 11 Elegido (Gran Ausente final o Más Pedido) y,
// en cada Puesto, la Camiseta de la Selección (celeste, negra la del arquero;
// sin número) con el nombre completo en uno o dos renglones. Los Clubes se
// dibujan como siempre.
import "server-only";
import { ImageResponse } from "next/og";
import { SELECCION } from "@/domain/comun/tipos";
import type { ModeloImagen, PuestoEnImagen } from "@/domain/compartir";
import { esPuestoDeArquero } from "@/domain/esquemas";
import { camiseta, LADO_CAMISETA, type Matriz } from "@/domain/pixel";

export const TAMANO_IMAGEN = { width: 1080, height: 1350 } as const;

const CANCHA = { izquierda: 40, arriba: 290, ancho: 1000, alto: 980, margen: 70 } as const;
const ANCHO_ROTULO = 280;

/** Lado de la Camiseta de la Selección en la imagen: 4 px por píxel de arte. */
const LADO_CAMISETA_IMAGEN = LADO_CAMISETA * 4;
/** El escudo de 48 px de arte, a 3 px por píxel. */
const LADO_ESCUDO = 144;

/** Una matriz de @/domain/pixel como SVG para Satori: un rect por tramo horizontal del mismo color. */
function SpriteParaImagen({ matriz, lado }: { matriz: Matriz; lado: number }) {
  const rects: { x: number; y: number; ancho: number; color: string }[] = [];
  matriz.forEach((fila, y) => {
    let x = 0;
    while (x < fila.length) {
      const color = fila[x];
      let fin = x + 1;
      while (fin < fila.length && fila[fin] === color) fin++;
      if (color) rects.push({ x, y, ancho: fin - x, color });
      x = fin;
    }
  });
  return (
    <svg width={lado} height={lado} viewBox={`0 0 ${matriz[0]?.length ?? 0} ${matriz.length}`} shapeRendering="crispEdges">
      {rects.map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.ancho} height={1} fill={r.color} />
      ))}
    </svg>
  );
}

/** El Puesto en la Selección: la Camiseta (o la sigla si está vacante) y el nombre completo en sus renglones. */
function PuestoDeLaSeleccion({ p }: { p: PuestoEnImagen }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {p.nombre ? (
        <SpriteParaImagen matriz={camiseta(SELECCION, esPuestoDeArquero(p.puesto) ? "ARQ" : "DEF")} lado={LADO_CAMISETA_IMAGEN} />
      ) : (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#5d8f60",
            color: "#10261a",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          {p.sigla}
        </div>
      )}
      <div
        style={{
          marginTop: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontSize: 24,
          lineHeight: 1.15,
          fontWeight: 700,
          padding: "2px 10px",
          borderRadius: 8,
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      >
        {(p.renglones.length ? p.renglones : ["Vacante"]).map((r) => (
          <div key={r} style={{ display: "flex", whiteSpace: "nowrap" }}>
            {r}
          </div>
        ))}
      </div>
    </div>
  );
}

export function imagenDe(
  modelo: ModeloImagen,
  headers: Record<string, string>,
  opciones: { escudo?: string | null } = {},
): ImageResponse {
  const seleccion = modelo.clubId === SELECCION;
  const util = { ancho: CANCHA.ancho - 2 * CANCHA.margen, alto: CANCHA.alto - 2 * CANCHA.margen };
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#10261a",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {seleccion ? (
          <div style={{ display: "flex", flexDirection: "column", padding: `28px ${40 + LADO_ESCUDO + 16}px 0 40px` }}>
            <div style={{ fontSize: 50, fontWeight: 700 }}>{modelo.titulo}</div>
            <div style={{ fontSize: 40, marginTop: 6 }}>{modelo.partido}</div>
            <div style={{ fontSize: 28, marginTop: 6, color: "#cfe3d4" }}>
              {`${modelo.fecha} · Esquema ${modelo.esquema}`}
            </div>
            {modelo.destacado && (
              <div style={{ display: "flex", fontSize: 28, marginTop: 6, color: "#9bd6fa", fontWeight: 700 }}>
                {`${modelo.destacado.titulo}: ${modelo.destacado.jugadores.map((j) => `${j.nombre} (${j.porcentaje})`).join(", ")}`}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", padding: "40px 40px 0 40px" }}>
            <div style={{ fontSize: 64, fontWeight: 700 }}>{modelo.titulo}</div>
            <div style={{ fontSize: 44, marginTop: 8 }}>{modelo.partido}</div>
            <div style={{ fontSize: 30, marginTop: 8, color: "#cfe3d4" }}>
              {`${modelo.fecha} · Esquema ${modelo.esquema}`}
            </div>
          </div>
        )}
        {seleccion && opciones.escudo && (
          // eslint-disable-next-line @next/next/no-img-element -- Satori dibuja <img>, no next/image.
          <img
            src={opciones.escudo}
            alt=""
            width={LADO_ESCUDO}
            height={LADO_ESCUDO}
            style={{ position: "absolute", right: 40, top: 28 }}
          />
        )}
        <div
          style={{
            position: "absolute",
            left: CANCHA.izquierda,
            top: CANCHA.arriba,
            width: CANCHA.ancho,
            height: CANCHA.alto,
            display: "flex",
            backgroundColor: "#2e7d32",
            border: "4px solid #e8f5e9",
            borderRadius: 16,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: CANCHA.alto / 2 - 2,
              width: CANCHA.ancho - 8,
              height: 4,
              backgroundColor: "#a5d6a7",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: CANCHA.ancho / 2 - 330 / 2 - 4,
              top: CANCHA.alto - 130 - 8,
              width: 330,
              height: 130,
              border: "4px solid #a5d6a7",
              borderBottom: "none",
            }}
          />
          {modelo.puestos.map((p) => (
            <div
              key={p.puesto}
              style={{
                position: "absolute",
                left: CANCHA.margen + p.x * util.ancho - ANCHO_ROTULO / 2,
                top: CANCHA.margen + p.yDesdeArriba * util.alto - 50,
                width: ANCHO_ROTULO,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {seleccion && <PuestoDeLaSeleccion p={p} />}
              {!seleccion && (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: p.nombre ? "#ffffff" : "#5d8f60",
                    color: "#10261a",
                    fontSize: 32,
                    fontWeight: 700,
                  }}
                >
                  {p.numero !== null ? String(p.numero) : p.sigla}
                </div>
              )}
              {!seleccion && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 26,
                    whiteSpace: "nowrap",
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: 8,
                    backgroundColor: "rgba(0,0,0,0.45)",
                  }}
                >
                  {p.nombre ?? "Vacante"}
                </div>
              )}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: 40,
            bottom: 24,
            fontSize: 26,
            color: "#cfe3d4",
            display: "flex",
          }}
        >
          Elegilos Vos
        </div>
      </div>
    ),
    { ...TAMANO_IMAGEN, headers },
  );
}
