// Dibujo de la imagen para compartir (ticket 16) a partir del modelo de
// @/domain/compartir. Diseño provisorio: lo rehace la etapa de diseño.
// Satori (next/og) solo entiende flexbox y posiciones absolutas.
import "server-only";
import { ImageResponse } from "next/og";
import type { ModeloImagen } from "@/domain/compartir";

export const TAMANO_IMAGEN = { width: 1080, height: 1350 } as const;

const CANCHA = { izquierda: 40, arriba: 290, ancho: 1000, alto: 980, margen: 70 } as const;
const ANCHO_ROTULO = 280;

export function imagenDe(modelo: ModeloImagen, headers: Record<string, string>): ImageResponse {
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
        <div style={{ display: "flex", flexDirection: "column", padding: "40px 40px 0 40px" }}>
          <div style={{ fontSize: 64, fontWeight: 700 }}>{modelo.titulo}</div>
          <div style={{ fontSize: 44, marginTop: 8 }}>{modelo.partido}</div>
          <div style={{ fontSize: 30, marginTop: 8, color: "#cfe3d4" }}>
            {`${modelo.fecha} · Esquema ${modelo.esquema}`}
          </div>
        </div>
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
