import { describe, expect, it } from "vitest";
import type { TextFetcher } from "../http";
import { parseProductUrl } from "../index";

describe("parseProductUrl", () => {
  it("rejects blocked URLs before touching the network", async () => {
    let called = 0;
    const f: TextFetcher = async () => { called++; return null; };
    await expect(parseProductUrl("http://127.0.0.1/admin", f)).resolves.toBeNull();
    await expect(parseProductUrl("ftp://example.com/", f)).resolves.toBeNull();
    expect(called).toBe(0);
  });
  it("routes WB to the card API and returns the normalized URL", async () => {
    const seen: string[] = [];
    const f: TextFetcher = async (url) => {
      seen.push(url);
      return { status: 200, contentType: "application/json", url, body: JSON.stringify({ data: { products: [{ id: 149763240, name: "X", sizes: [{ price: { product: 100 } }] }] } }) };
    };
    const p = await parseProductUrl("https://www.wildberries.ru/catalog/149763240/detail.aspx?utm_source=x", f);
    expect(seen[0]).toContain("card.wb.ru/cards/v2/detail");
    expect(p).toMatchObject({ source: "wb", price: 1, url: "https://www.wildberries.ru/catalog/149763240/detail.aspx" });
  });
  it("routes everything else to Open Graph and never throws", async () => {
    const f: TextFetcher = async (url) => ({ status: 200, contentType: "text/html", url, body: '<meta property="og:title" content="Thing">' });
    expect(await parseProductUrl("https://www.ozon.ru/product/thing-1", f)).toMatchObject({ source: "ozon", title: "Thing" });
    const throwing: TextFetcher = async () => { throw new Error("boom"); };
    await expect(parseProductUrl("https://www.ozon.ru/product/thing-1", throwing)).resolves.toBeNull();
  });
});
