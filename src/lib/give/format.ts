import { fmtPrice } from "../types";

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function rangeText(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${fmtPrice(min)}–${fmtPrice(max)}`;
  if (max != null) return `до ${fmtPrice(max)}`;
  if (min != null) return `от ${fmtPrice(min)}`;
  return "бюджет не указан";
}

export function budgetText(budget: number | null): string {
  return budget == null ? "бюджет не важен" : `до ${fmtPrice(budget)}`;
}

export function sourceLabel(source: string | null): string {
  if (!source) return "магазин";
  if (source === "ym") return "Яндекс Маркет";
  return source.toUpperCase();
}

/** Whole days from `today` (YYYY-MM-DD) to `date` (YYYY-MM-DD); positive = in the future. */
export function daysBetween(today: string, date: string): number {
  const a = Date.parse(today + "T00:00:00Z"), b = Date.parse(date + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function countdownText(days: number): string {
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days > 1) return `через ${days} ${plural(days, "день", "дня", "дней")}`;
  const p = -days;
  return `${p} ${plural(p, "день", "дня", "дней")} назад`;
}

export function fmtDate(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
