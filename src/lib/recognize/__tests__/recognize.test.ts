import { describe, expect, it } from "vitest";
import { queriesFromRecognition, titleFromRecognition, RecognitionSchema } from "../recognize";

describe("recognition mapping", () => {
  const r = RecognitionSchema.parse({ brand: "Timemore", product: "Кофемолка ручная C2", variant: "чёрная", category: "кофе", price_rub: 4290, confidence: "high" });
  it("joins brand, product and variant into a title", () => {
    expect(titleFromRecognition(r)).toBe("Timemore Кофемолка ручная C2 чёрная");
  });
  it("searches with the full title first, then brand + product", () => {
    expect(queriesFromRecognition(r)).toEqual(["Timemore Кофемолка ручная C2 чёрная", "Timemore Кофемолка ручная C2"]);
  });
  it("copes with nulls", () => {
    const empty = RecognitionSchema.parse({ brand: null, product: "Кружка", variant: null, category: null, price_rub: null, confidence: "low" });
    expect(titleFromRecognition(empty)).toBe("Кружка");
    expect(queriesFromRecognition(empty)).toEqual(["Кружка"]);
  });
});
