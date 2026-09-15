import { describe, expect, it } from "vitest";
import { parseSharePayload } from "../parseShare";

describe("parseSharePayload", () => {
  it("pulls the URL and product name out of an Ozon share text", () => {
    const r = parseSharePayload({ text: "Товар на Ozon: Кроссовки New Balance 530, белые https://ozon.ru/t/AbCdEf" });
    expect(r.url).toBe("https://ozon.ru/t/AbCdEf");
    expect(r.title).toBe("Кроссовки New Balance 530, белые");
  });
  it("handles WB share (url in a separate field, title with store suffix)", () => {
    const r = parseSharePayload({ title: "Kindle Paperwhite 16 ГБ на Wildberries", url: "https://www.wildberries.ru/catalog/1167502010/detail.aspx" });
    expect(r.url).toBe("https://www.wildberries.ru/catalog/1167502010/detail.aspx");
    expect(r.title).toBe("Kindle Paperwhite 16 ГБ");
  });
  it("returns title null when only a URL was shared", () => {
    const r = parseSharePayload({ text: "https://market.yandex.ru/product--x/1" });
    expect(r.url).toBe("https://market.yandex.ru/product--x/1");
    expect(r.title).toBeNull();
  });
  it("returns url null and keeps a plain text as title", () => {
    const r = parseSharePayload({ text: "Хочу кофемолку Timemore C2" });
    expect(r.url).toBeNull();
    expect(r.title).toBe("Хочу кофемолку Timemore C2");
  });
  it("strips trailing punctuation from URLs and ignores empty payloads", () => {
    expect(parseSharePayload({ text: "Смотри: https://ozon.ru/t/xyz." }).url).toBe("https://ozon.ru/t/xyz");
    expect(parseSharePayload({})).toEqual({ url: null, title: null });
  });
});
