import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/wb-search.json";
import { mapWbSearch, queryFromSlug, searchWb, wbSearchUrl } from "../wbSearch";
import type { TextFetcher } from "../http";

describe("wbSearch", () => {
  it("maps the search payload to candidates with rub prices", () => {
    const c = mapWbSearch(fixture, 3);
    expect(c).toHaveLength(3);
    expect(c[0].id).toBeGreaterThan(0);
    expect(c[0].price).toBeGreaterThan(0);
    expect(c[0].url).toContain(`/catalog/${c[0].id}/`);
  });
  it("returns [] for malformed payloads", () => {
    expect(mapWbSearch(null)).toEqual([]);
    expect(mapWbSearch({ products: "nope" })).toEqual([]);
  });
  it("builds a query from an Ozon-style slug and ignores ids", () => {
    expect(queryFromSlug("https://www.ozon.ru/product/krossovki-new-balance-530-belye-1234567890/")).toBe("krossovki new balance 530 belye");
    expect(queryFromSlug("https://market.yandex.ru/product--kindle-paperwhite-16-gb/1791212489?sku=1")).toBe("kindle paperwhite 16 gb");
    expect(queryFromSlug("https://ozon.ru/t/AbCdEf")).toBeNull();
  });
  it("encodes the query and limits the results", () => {
    expect(wbSearchUrl("кофе дома", 5)).toContain("query=%D0%BA%D0%BE%D1%84%D0%B5%20%D0%B4%D0%BE%D0%BC%D0%B0&resultset=catalog&limit=5");
  });
  it("searches through the browser TLS profile and verifies images", async () => {
    const calls: string[] = [];
    const f: TextFetcher = async (url, opts) => { calls.push(`${opts?.tlsProfile}:${url}`); return { status: 200, contentType: "application/json", body: JSON.stringify(fixture), url }; };
    const c = await searchWb("new balance 530", f, async () => 200, 2);
    expect(c).toHaveLength(2);
    expect(c[0].image).toMatch(/wbbasket\.ru/);
    expect(calls[0]).toMatch(/^browser:https:\/\/search\.wb\.ru/);
  });
  it("never throws", async () => {
    const boom: TextFetcher = async () => { throw new Error("x"); };
    await expect(searchWb("abc", boom, async () => 200)).resolves.toEqual([]);
    await expect(searchWb("ab", boom, async () => 200)).resolves.toEqual([]);
  });
});
