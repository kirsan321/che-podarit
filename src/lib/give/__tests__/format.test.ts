import { describe, expect, it } from "vitest";
import { countdownText, daysBetween, plural, rangeText } from "../format";

describe("plural", () => {
  it("picks russian forms", () => {
    expect(plural(1, "день", "дня", "дней")).toBe("день");
    expect(plural(3, "день", "дня", "дней")).toBe("дня");
    expect(plural(11, "день", "дня", "дней")).toBe("дней");
    expect(plural(21, "день", "дня", "дней")).toBe("день");
    expect(plural(25, "день", "дня", "дней")).toBe("дней");
  });
});

describe("countdown", () => {
  it("counts whole days between iso dates", () => {
    expect(daysBetween("2026-09-15", "2026-09-15")).toBe(0);
    expect(daysBetween("2026-09-15", "2026-12-31")).toBe(107);
    expect(daysBetween("2026-09-15", "2026-09-10")).toBe(-5);
  });
  it("formats", () => {
    expect(countdownText(0)).toBe("сегодня");
    expect(countdownText(1)).toBe("завтра");
    expect(countdownText(59)).toBe("через 59 дней");
    expect(countdownText(-2)).toBe("2 дня назад");
  });
});

describe("rangeText", () => {
  it("handles partial ranges", () => {
    expect(rangeText(3000, 6000)).toContain("–");
    expect(rangeText(null, 6000).startsWith("до")).toBe(true);
    expect(rangeText(3000, null).startsWith("от")).toBe(true);
    expect(rangeText(null, null)).toBe("бюджет не указан");
  });
});
