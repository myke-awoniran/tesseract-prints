// Calendar maths in Lagos time: West Africa Time, UTC+1, no daylight saving.
export const LAGOS_OFFSET_MS = 60 * 60 * 1000;
export const DAY = 24 * 60 * 60 * 1000;

export interface Period {
  year: number;
  month: number;
}

export function startOfLagosDay(at = new Date()): Date {
  const local = new Date(at.getTime() + LAGOS_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - LAGOS_OFFSET_MS);
}

export function startOfLagosMonth(at = new Date()): Date {
  const local = new Date(at.getTime() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - LAGOS_OFFSET_MS);
}

/** The Lagos calendar month an instant falls in. */
export function lagosPeriod(at = new Date()): Period {
  const local = new Date(at.getTime() + LAGOS_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1 };
}

export function shiftPeriod({ year, month }: Period, by: number): Period {
  const d = new Date(Date.UTC(year, month - 1 + by, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** [start, end) of a Lagos calendar month, as UTC instants. */
export function periodBounds({ year, month }: Period): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - LAGOS_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - LAGOS_OFFSET_MS)
  };
}

export function periodKey({ year, month }: Period): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
