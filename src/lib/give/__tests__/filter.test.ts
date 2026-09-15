import { describe, expect, it } from "vitest";
import { deckItems, fitsBudget } from "../filter";

describe("fitsBudget", () => {
  it("exact: passes when price is null or <= budget", () => {
    expect(fitsBudget({ kind: "exact", price: null, price_min: null }, 1500)).toBe(true);
    expect(fitsBudget({ kind: "exact", price: 1500, price_min: null }, 1500)).toBe(true);
    expect(fitsBudget({ kind: "exact", price: 1501, price_min: null }, 1500)).toBe(false);
  });
  it("direction: uses price_min, ignores price and price_max", () => {
    expect(fitsBudget({ kind: "direction", price: 99999, price_min: null }, 1500)).toBe(true);
    expect(fitsBudget({ kind: "direction", price: null, price_min: 3000 }, 5000)).toBe(true);
    expect(fitsBudget({ kind: "direction", price: null, price_min: 3000 }, 1500)).toBe(false);
  });
  it("null budget means no limit", () => {
    expect(fitsBudget({ kind: "exact", price: 1_000_000, price_min: null }, null)).toBe(true);
    expect(fitsBudget({ kind: "direction", price: null, price_min: 1_000_000 }, null)).toBe(true);
  });
});

describe("deckItems", () => {
  const items = [
    { id: "a", kind: "exact" as const, price: 1000, price_min: null, reserved: false },
    { id: "b", kind: "exact" as const, price: 9000, price_min: null, reserved: false },
    { id: "c", kind: "exact" as const, price: 500, price_min: null, reserved: true },
    { id: "d", kind: "direction" as const, price: null, price_min: 3000, reserved: false },
    { id: "e", kind: "direction" as const, price: null, price_min: null, reserved: false },
  ];
  it("drops reserved items and those over budget, keeps order", () => {
    expect(deckItems(items, 5000).map((i) => i.id)).toEqual(["a", "d", "e"]);
    expect(deckItems(items, 1500).map((i) => i.id)).toEqual(["a", "e"]);
  });
  it("with no budget keeps everything not reserved", () => {
    expect(deckItems(items, null).map((i) => i.id)).toEqual(["a", "b", "d", "e"]);
  });
});
