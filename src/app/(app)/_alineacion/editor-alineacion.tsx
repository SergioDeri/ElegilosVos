"use client";

// Cancha + banco. La UI solo despacha operaciones del Editor de Alineación
// (@/domain/editor); cada cambio aceptado se guarda solo (con debounce).
//
// Interacción:
// - Arrastrar (mouse, toque prolongado o teclado) un Jugador del banco a un
//   Puesto (colocar/reemplazar), un Puesto a otro (mover/intercambiar) o un
//   Puesto al banco (quitar).
// - Alternativa sin arrastre: tocar un Jugador o un Puesto ocupado para
//   seleccionarlo y después tocar el destino (o "Quitar").
import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { PuestoEnCancha as CajaDePuesto } from "@/domain/cancha";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  banco,
  cambiarEsquema,
  colocar,
  desdeJson,
  mover,
  quitar,
  type Alineacion,
  type AlineacionJson,
  type ResultadoOperacion,
} from "@/domain/editor";
import { esEsquemaId, esquema, esquemas, type PuestoId } from "@/domain/esquemas";
import type { JugadorDelClub } from "@/lib/club/lecturas";
import { NOMBRE_DISPONIBILIDAD } from "@/domain/comun/textos";
import { MENSAJE_DE_RECHAZO, POSICION } from "./textos";
import { useGuardadoAutomatico, type EstadoGuardado } from "./use-guardado-automatico";
import { SELECCION, type ClubOSeleccion } from "@/domain/comun/tipos";
import { BancoPixel, CanchaPixel } from "@/app/_cancha/cancha-pixel";
import { PuestoLibre } from "@/app/_cancha/puesto-libre";
import { JugadorConCamiseta } from "@/app/_pixel/jugador-con-camiseta";
import { Icono } from "@/app/_pixel/icono";
import estilos from "./alineacion.module.css";
import efectos from "@/app/_pixel/efectos.module.css";

type Origen = { tipo: "jugador"; jugadorId: string } | { tipo: "puesto"; puesto: PuestoId };

const ID_BANCO = "banco";
const idPuesto = (p: PuestoId) => `puesto:${p}`;
const idJugador = (j: string) => `jugador:${j}`;
/** "10 Nombre" en un Club; solo el nombre en la Selección, que no lleva número. */
const conNumero = (j: JugadorDelClub) => (j.numero === null ? j.nombre : `${j.numero} ${j.nombre}`);

/**
 * Con mouse o toque manda el puntero (el banco es ancho y taparía Puestos
 * vecinos); con teclado no hay puntero y se usa la intersección.
 */
const deteccion: CollisionDetection = (args) => {
  const bajoElPuntero = pointerWithin(args);
  return bajoElPuntero.length > 0 ? bajoElPuntero : rectIntersection(args);
};

function leerOrigen(id: string | number): Origen | null {
  const [tipo, valor] = String(id).split(":");
  if (tipo === "jugador" && valor) return { tipo: "jugador", jugadorId: valor };
  if (tipo === "puesto" && valor) return { tipo: "puesto", puesto: valor as PuestoId };
  return null;
}

export interface PropsEditor {
  partidoId: string;
  /** De quién es el Partido (el Club Favorito del Hincha o la Selección): el de las Camisetas. */
  club: ClubOSeleccion;
  inicial: AlineacionJson | null;
  jugadores: JugadorDelClub[];
  /** false: solo lectura (sin Votación abierta). */
  editable: boolean;
  /**
   * Se muestra cuando hay una Alineación guardada (la de la base o una
   * guardada en esta visita). P. ej. la invitación a elegir Club del Hincha
   * sin Club (Selección, ticket 06).
   */
  conAlineacionGuardada?: ReactNode;
}

export function EditorAlineacion({ partidoId, club, inicial, jugadores, editable, conAlineacionGuardada }: PropsEditor) {
  const router = useRouter();
  const [alineacion, setAlineacion] = useState<Alineacion>(() => {
    const leida = inicial ? desdeJson(inicial) : null;
    return leida?.ok ? leida.estado : { esquema: "4-3-3", esquemaElegidoAMano: false, puestos: {} };
  });
  const [seleccion, setSeleccion] = useState<Origen | null>(null);
  const [arrastrando, setArrastrando] = useState<{ origen: Origen; ancho: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Último Puesto donde se soltó una Camiseta: salta y suelta partículas.
  const [salto, setSalto] = useState<{ puesto: PuestoId; vez: number } | null>(null);
  const { estado: guardado, guardoAlgunaVez, programar, reintentar } = useGuardadoAutomatico(partidoId);
  // Si el servidor dice que la Votación cerró, se recarga la pantalla (solo lectura).
  useEffect(() => {
    if (guardado.tipo === "cerrada") router.refresh();
  }, [guardado.tipo, router]);
  const puedeEditar = editable && guardado.tipo !== "cerrada" && guardado.tipo !== "invalida";

  const porId = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores]);
  const libres = banco(alineacion, jugadores);
  const noDisponibles = jugadores.filter((j) => j.enPlantel && j.disponibilidad !== "disponible");

  function aplicar(resultado: ResultadoOperacion) {
    setSeleccion(null);
    if (!resultado.ok) {
      setAviso(MENSAJE_DE_RECHAZO[resultado.motivo]);
      return;
    }
    setAviso(null);
    if (resultado.estado === alineacion) return;
    setAlineacion(resultado.estado);
    programar(resultado.estado);
  }

  /** Suelta `origen` sobre un Puesto o sobre el banco. */
  function soltar(origen: Origen, destino: PuestoId | typeof ID_BANCO) {
    if (!puedeEditar) return;
    const ahora = new Date();
    if (destino === ID_BANCO) {
      if (origen.tipo === "puesto") aplicar(quitar(alineacion, origen.puesto));
      else setSeleccion(null);
      return;
    }
    const resultado =
      origen.tipo === "jugador"
        ? colocar(alineacion, origen.jugadorId, destino, jugadores, ahora)
        : mover(alineacion, origen.puesto, destino, jugadores, ahora);
    aplicar(resultado);
    if (resultado.ok && resultado.estado !== alineacion) setSalto((s) => ({ puesto: destino, vez: (s?.vez ?? 0) + 1 }));
  }

  function tocarPuesto(puesto: PuestoId) {
    if (!puedeEditar) return;
    if (seleccion && !(seleccion.tipo === "puesto" && seleccion.puesto === puesto)) {
      soltar(seleccion, puesto);
      return;
    }
    if (seleccion) {
      setSeleccion(null);
      return;
    }
    if (alineacion.puestos[puesto]) setSeleccion({ tipo: "puesto", puesto });
  }

  function tocarJugador(jugadorId: string) {
    if (!puedeEditar) return;
    setAviso(null);
    setSeleccion((s) => (s?.tipo === "jugador" && s.jugadorId === jugadorId ? null : { tipo: "jugador", jugadorId }));
  }

  function elegirEsquema(valor: string) {
    if (!puedeEditar || !esEsquemaId(valor)) return;
    aplicar(cambiarEsquema(alineacion, valor, new Date()));
  }

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function alEmpezar(e: DragStartEvent) {
    setSeleccion(null);
    const origen = leerOrigen(e.active.id);
    const ancho = Number(e.active.data.current?.ancho ?? 24);
    setArrastrando(origen ? { origen, ancho } : null);
  }

  function alTerminar(e: DragEndEvent) {
    setArrastrando(null);
    const origen = leerOrigen(e.active.id);
    if (!origen || !e.over) return;
    const destino = String(e.over.id);
    if (destino === ID_BANCO) soltar(origen, ID_BANCO);
    else if (destino.startsWith("puesto:")) soltar(origen, destino.slice("puesto:".length) as PuestoId);
  }

  const nombreDe = (id: string | number) => {
    const o = leerOrigen(id);
    if (!o) return "";
    if (o.tipo === "jugador") return porId.get(o.jugadorId)?.nombre ?? "";
    const j = alineacion.puestos[o.puesto];
    return j ? (porId.get(j.jugadorId)?.nombre ?? "") : "";
  };
  const destinoDe = (id: string | number | undefined) => {
    if (id === undefined) return "fuera de la cancha";
    if (id === ID_BANCO) return "el banco";
    const p = esquema(alineacion.esquema).puestos.find((x) => idPuesto(x.id) === id);
    return p ? `el Puesto ${p.etiqueta}` : "";
  };
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Agarraste a ${nombreDe(active.id)}.`,
    onDragOver: ({ active, over }) => `${nombreDe(active.id)} está sobre ${destinoDe(over?.id)}.`,
    onDragEnd: ({ active, over }) => `Soltaste a ${nombreDe(active.id)} en ${destinoDe(over?.id)}.`,
    onDragCancel: ({ active }) => `Cancelaste. ${nombreDe(active.id)} vuelve a su lugar.`,
  };

  const seleccionado =
    seleccion?.tipo === "jugador"
      ? porId.get(seleccion.jugadorId)
      : seleccion
        ? porId.get(alineacion.puestos[seleccion.puesto]?.jugadorId ?? "")
        : undefined;
  const origenArrastre = arrastrando?.origen;
  const enArrastre =
    origenArrastre?.tipo === "jugador"
      ? porId.get(origenArrastre.jugadorId)
      : origenArrastre
        ? porId.get(alineacion.puestos[origenArrastre.puesto]?.jugadorId ?? "")
        : undefined;

  return (
    <DndContext
      id={useId()}
      sensors={sensores}
      collisionDetection={deteccion}
      onDragStart={alEmpezar}
      onDragEnd={alTerminar}
      onDragCancel={() => setArrastrando(null)}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable:
            "Para mover un Jugador con el teclado, apretá espacio o enter, movelo con las flechas y apretá espacio o enter para soltarlo. Escape cancela.",
        },
      }}
    >
      <section aria-label="Tu Alineación" className={estilos.editor}>
        <div className={estilos.barra}>
          <label>
            Esquema{" "}
            <select
              value={alineacion.esquemaElegidoAMano ? alineacion.esquema : ""}
              onChange={(e) => elegirEsquema(e.target.value)}
              disabled={!puedeEditar}
            >
              {!alineacion.esquemaElegidoAMano && <option value="">Elegí un Esquema ({alineacion.esquema})</option>}
              {esquemas().map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          {editable && <IndicadorGuardado estado={guardado} reintentar={reintentar} />}
        </div>
        {(inicial !== null || guardoAlgunaVez) && conAlineacionGuardada}

        {/* Alto fijo: que aparezca un aviso o las acciones no mueve la cancha. */}
        <div className={estilos.renglon}>
          <p aria-live="polite" className={estilos.aviso}>
            {aviso ??
              (seleccionado && puedeEditar
                ? `Elegiste a ${seleccionado.nombre}. Tocá un Puesto${seleccion?.tipo === "puesto" ? " o Quitar" : ""}.`
                : "")}
          </p>
          {seleccion?.tipo === "puesto" && puedeEditar && (
            <>
              <button type="button" onClick={() => aplicar(quitar(alineacion, seleccion.puesto))}>
                Quitar
              </button>
              <button type="button" onClick={() => setSeleccion(null)}>
                Cancelar
              </button>
            </>
          )}
        </div>

        <CanchaPixel
          className={estilos.area}
          esquema={alineacion.esquema}
          // En la Selección el nombre completo puede ir en dos renglones.
          renglones={club === SELECCION ? 2 : 1}
          // Con la Votación abierta siempre hay banco, aunque esté vacío: es
          // donde se suelta un Jugador para sacarlo de la cancha.
          suplentes={editable ? Math.max(1, libres.length) : 0}
          role="group"
          aria-label={`Cancha, Esquema ${alineacion.esquema}`}
          puesto={(caja) => {
            const ocupado = alineacion.puestos[caja.id];
            const jugador = ocupado ? porId.get(ocupado.jugadorId) : undefined;
            return (
              <PuestoEnCancha
                club={club}
                caja={caja}
                jugador={jugador}
                jugadorIdDesconocido={ocupado && !jugador ? ocupado.jugadorId : undefined}
                editable={puedeEditar}
                seleccionado={seleccion?.tipo === "puesto" && seleccion.puesto === caja.id}
                salto={salto?.puesto === caja.id ? salto.vez : undefined}
                alTocar={() => tocarPuesto(caja.id)}
              />
            );
          }}
          banco={(b) => (
            <Banco editable={puedeEditar} cantidad={libres.length}>
              <BancoPixel banco={b}>
                {libres.map((j) => (
                  <li key={j.id}>
                    <JugadorDelBanco
                      club={club}
                      jugador={j}
                      ancho={b.anchoItem}
                      editable={puedeEditar}
                      seleccionado={seleccion?.tipo === "jugador" && seleccion.jugadorId === j.id}
                      alTocar={() => tocarJugador(j.id)}
                    />
                  </li>
                ))}
              </BancoPixel>
            </Banco>
          )}
        />
      </section>

      {editable && noDisponibles.length > 0 && (
        <section aria-label="No disponibles">
          <h2>No disponibles</h2>
          <ul className={estilos.lista}>
            {noDisponibles.map((j) => (
              <li key={j.id} className={estilos.noDisponible}>
                <span>
                  {j.numero !== null && `${j.numero} · `}{j.nombre} · {POSICION[j.posicionNatural]}
                </span>
                <small>
                  {NOMBRE_DISPONIBILIDAD[j.disponibilidad]}
                  {j.motivo ? `: ${j.motivo}` : ""}
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}
      <DragOverlay>
        {enArrastre && arrastrando ? (
          <JugadorConCamiseta club={club} jugador={enArrastre} ancho={arrastrando.ancho} className={estilos.arrastrado} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function IndicadorGuardado({ estado, reintentar }: { estado: EstadoGuardado; reintentar: () => void }) {
  const texto: Record<EstadoGuardado["tipo"], string> = {
    guardado: "Guardado",
    pendiente: "Cambios sin guardar…",
    guardando: "Guardando…",
    error: "No se pudo guardar. Reintentando…",
    cerrada: "La Votación cerró: este cambio no se guardó.",
    invalida: "Algo cambió en el Plantel y este cambio no se guardó. Recargá la página.",
  };
  return (
    <span role="status" aria-live="polite" className={estilos.guardado} data-estado={estado.tipo}>
      {estado.tipo === "guardado" && <Icono nombre="guardado" />}
      {texto[estado.tipo]}{" "}
      {estado.tipo === "error" && (
        <button type="button" onClick={reintentar}>
          Reintentar ahora
        </button>
      )}
      {estado.tipo === "invalida" && (
        <button type="button" onClick={() => window.location.reload()}>
          Recargar
        </button>
      )}
    </span>
  );
}

function PuestoEnCancha(props: {
  club: ClubOSeleccion;
  caja: CajaDePuesto;
  jugador: JugadorDelClub | undefined;
  jugadorIdDesconocido: string | undefined;
  editable: boolean;
  seleccionado: boolean;
  /** Cuántas veces se soltó una Camiseta acá (cambia: salta de nuevo). */
  salto: number | undefined;
  alTocar: () => void;
}) {
  const { club, caja, jugador, editable, seleccionado, salto, alTocar } = props;
  const etiqueta = caja.etiqueta;
  const ocupado = !!jugador || !!props.jugadorIdDesconocido;
  const soltable = useDroppable({ id: idPuesto(caja.id), disabled: !editable });
  const arrastrable = useDraggable({ id: idPuesto(caja.id), disabled: !editable || !ocupado, data: { ancho: caja.ancho } });
  const noDisponible = jugador && (jugador.disponibilidad !== "disponible" || !jugador.enPlantel);
  const descripcion = jugador
    ? `${etiqueta}: ${conNumero(jugador)}${noDisponible ? " (no disponible)" : ""}`
    : `${etiqueta}: vacío`;

  return (
    <button
      type="button"
      ref={(nodo) => {
        soltable.setNodeRef(nodo);
        arrastrable.setNodeRef(nodo);
      }}
      {...(editable && ocupado ? arrastrable.listeners : {})}
      {...arrastrable.attributes}
      aria-label={descripcion}
      aria-pressed={seleccionado}
      aria-disabled={!editable}
      onClick={alTocar}
      className={estilos.puesto}
      data-ocupado={ocupado}
      data-sobre={soltable.isOver}
      data-arrastrando={arrastrable.isDragging}
      data-seleccionado={seleccionado}
      data-no-disponible={!!noDisponible}
    >
      {jugador ? (
        <>
          {salto === undefined ? (
            <JugadorConCamiseta club={club} jugador={jugador} ancho={caja.ancho} />
          ) : (
            <span key={salto} className={efectos.salto}>
              <JugadorConCamiseta club={club} jugador={jugador} ancho={caja.ancho} />
              <Particulas />
            </span>
          )}
          {noDisponible && <span className={estilos.alerta}>!</span>}
        </>
      ) : (
        <PuestoLibre texto={props.jugadorIdDesconocido ? "?" : caja.sigla} ancho={caja.ancho} />
      )}
    </button>
  );
}

function Banco(props: { editable: boolean; cantidad: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: ID_BANCO, disabled: !props.editable });
  return (
    <div ref={setNodeRef} className={estilos.banco} data-sobre={isOver} aria-label={`Suplentes (${props.cantidad})`} role="group">
      {props.children}
    </div>
  );
}

function JugadorDelBanco(props: {
  club: ClubOSeleccion;
  jugador: JugadorDelClub;
  ancho: number;
  editable: boolean;
  seleccionado: boolean;
  alTocar: () => void;
}) {
  const { club, jugador, ancho, editable, seleccionado, alTocar } = props;
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: idJugador(jugador.id),
    disabled: !editable,
    data: { ancho },
  });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-pressed={seleccionado}
      aria-label={`${conNumero(jugador)}, ${POSICION[jugador.posicionNatural]}`}
      onClick={alTocar}
      className={estilos.ficha}
      data-seleccionado={seleccionado}
      data-arrastrando={isDragging}
    >
      <JugadorConCamiseta club={club} jugador={jugador} ancho={ancho} />
    </button>
  );
}

/** Destinos de las partículas, en píxeles de arte (múltiplos de 4: 4 pasos enteros). */
const PARTICULAS = [
  [-8, -8],
  [0, -12],
  [8, -8],
  [-12, 0],
  [12, 0],
  [-8, 4],
  [8, 4],
  [0, 8],
] as const;

function Particulas() {
  return (
    <span className={efectos.particulas} aria-hidden>
      {PARTICULAS.map(([dx, dy], i) => (
        <span key={i} className={efectos.particula} style={{ "--dx": dx, "--dy": dy } as CSSProperties} />
      ))}
    </span>
  );
}
