import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TextFetcher } from "../http";
import { decodeEntities, extractOg, ogToProduct, parseOg, parsePrice } from "../og";

const fx = (name: string) => readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");
const base = "https://shop.example.com/p/nb574";

describe("extractOg", () => {
  it("reads og:title, og:image (relative), product:price:amount", () => {
    const og = extractOg(fx("og-full.html"), base);
    expect(og).toEqual({
      title: 'Кроссовки New Balance 574 "Grey"',
      titleFromMeta: true,
      image: "https://shop.example.com/media/nb574.jpg",
      price: 12990,
      currency: "RUB",
    });
    expect(ogToProduct(og, base)).toMatchObject({ confidence: "high", source: "other", price: 12990 });
  });
  it("reads JSON-LD Product inside @graph", () => {
    const og = extractOg(fx("og-jsonld.html"), base);
    expect(og.title).toBe("Кофемолка Timemore Chestnut C3");
    expect(og.image).toBe("https://cdn.example.com/c3.jpg");
    expect(og.price).toBe(6490);
    expect(og.currency).toBe("RUB");
    expect(ogToProduct(og, base)?.confidence).toBe("low");
  });
  it("reads itemprop=price with a content attribute and falls back to <title>", () => {
    const og = extractOg(fx("og-itemprop.html"), base);
    expect(og.title).toBe("Пылесос Dyson V8");
    expect(og.price).toBe(34990);
    expect(og.image).toBeNull();
  });
  it("drops non-RUB prices but keeps the title", () => {
    const p = ogToProduct(extractOg(fx("og-foreign-currency.html"), base), base);
    expect(p).toMatchObject({ title: "Sony WH-1000XM5", price: null, image: "https://cdn.example.com/xm5.png", confidence: "low" });
  });
  it("returns null product when there is no title at all", () => {
    const og = extractOg(fx("og-missing.html"), base);
    expect(og.title).toBeNull();
    expect(ogToProduct(og, base)).toBeNull();
  });
});

describe("helpers", () => {
  it("parsePrice handles ru and en formats", () => {
    expect(parsePrice("12 990,00")).toBe(12990);
    expect(parsePrice("12,990.50")).toBe(12990.5);
    expect(parsePrice("4990 ₽")).toBe(4990);
    expect(parsePrice(1234)).toBe(1234);
    expect(parsePrice("0")).toBeNull();
    expect(parsePrice("free")).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });
  it("decodeEntities handles named, decimal and hex entities", () => {
    expect(decodeEntities("A &amp; B &quot;C&quot; &#8381; &#x41;")).toBe('A & B "C" ₽ A');
  });
});

describe("parseOg", () => {
  const html = fx("og-full.html");
  it("parses a 200 HTML response", async () => {
    const f: TextFetcher = async (url) => ({ status: 200, contentType: "text/html", body: html, url });
    expect((await parseOg(base, f))?.title).toContain("New Balance");
  });
  it("ignores non-HTML, non-200 and failed fetches", async () => {
    const json: TextFetcher = async (url) => ({ status: 200, contentType: "application/json", body: "{}", url });
    const notFound: TextFetcher = async (url) => ({ status: 404, contentType: "text/html", body: html, url });
    const dead: TextFetcher = async () => null;
    const throwing: TextFetcher = async () => { throw new Error("boom"); };
    for (const f of [json, notFound, dead, throwing]) await expect(parseOg(base, f)).resolves.toBeNull();
  });
});
