// Horas: en la base y en la lógica de dominio todo es UTC (objetos Date o
// timestamps ISO con "Z"). Solo en el borde de la UI se convierte a la hora
// de Uruguay con estas funciones.

export const ZONA_HORARIA_UY = "America/Montevideo";

const formateadorUy = new Intl.DateTimeFormat("es-UY", {
  timeZone: ZONA_HORARIA_UY,
  dateStyle: "medium",
  timeStyle: "short",
  hourCycle: "h23",
});

/** Formatea un instante para mostrarlo en hora de Montevideo. */
export function formatearHoraUy(instante: Date): string {
  return formateadorUy.format(instante);
}

const partesUy = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA_UY,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Diferencia (en ms) entre la hora de Montevideo y UTC en ese instante. */
function desfaseUyMs(instante: Date): number {
  const p = Object.fromEntries(partesUy.formatToParts(instante).map((x) => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/**
 * Convierte una fecha y hora "de pared" de Montevideo (por ejemplo el valor de
 * un <input type="datetime-local">, "2026-11-10T20:00") al instante UTC.
 */
export function desdeHoraUy(fechaHoraLocal: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(fechaHoraLocal);
  if (!m) throw new Error(`Fecha y hora inválida: ${fechaHoraLocal}`);
  const [, a, mes, d, h, min, s = "0"] = m;
  const comoUtc = Date.UTC(+a, +mes - 1, +d, +h, +min, +s);
  // Dos pasadas por si el desfase cambia cerca de un cambio de horario.
  let instante = comoUtc - desfaseUyMs(new Date(comoUtc));
  instante = comoUtc - desfaseUyMs(new Date(instante));
  return new Date(instante);
}

/** Inverso de desdeHoraUy: "YYYY-MM-DDTHH:mm" en hora de Montevideo. */
export function aHoraUyLocal(instante: Date): string {
  const p = Object.fromEntries(partesUy.formatToParts(instante).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
