import type { ItemKind } from "../types";

export interface BudgetItem {
  kind: ItemKind;
  price: number | null;
  price_min: number | null;
  reserved?: boolean;
}

/**
 * Budget rule: exact items pass if price is unknown or <= budget;
 * direction items pass if price_min is unknown or <= budget; null budget = no limit.
 */
export function fitsBudget(item: BudgetItem, budget: number | null): boolean {
  if (budget == null) return true;
  const floor = item.kind === "direction" ? item.price_min : item.price;
  return floor == null || floor <= budget;
}

/** Deck source: not reserved by anyone and within budget. Keeps the original order. */
export function deckItems<T extends BudgetItem>(items: T[], budget: number | null): T[] {
  return items.filter((it) => !it.reserved && fitsBudget(it, budget));
}
