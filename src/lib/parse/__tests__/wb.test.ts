import { describe, expect, it } from "vitest";
import v1 from "../__fixtures__/wb-v1.json";
import v2 from "../__fixtures__/wb-v2.json";
import v2NoPrice from "../__fixtures__/wb-v2-no-price.json";
import v4 from "../__fixtures__/wb-v4.json";
import type { FetchTextResult, HeadFetcher, TextFetcher } from "../http";
import { basketHost, extractNm, guessBasket, mapWbV1, mapWbV2, parseWb, resolveWbImage, wbImageUrl } from "../wb";

const nm = 149763240;

describe("extractNm", () => {
  it("reads the article from common WB URL shapes", () => {
    expect(extractNm("https://www.wildberries.ru/catalog/149763240/detail.aspx")).toBe(nm);
    expect(extractNm("https://www.wildberries.ru/catalog/149763240/detail.aspx?size=123&targetUrl=GP")).toBe(nm);
    expect(extractNm("https://wildberries.ru/catalog/149763240/feedbacks")).toBe(nm);
    expect(extractNm("https://wb.ru/catalog/149763240/detail.aspx")).toBe(nm);
    expect(extractNm("https://global.wildberries.ru/product?card=149763240")).toBe(nm);
    expect(extractNm("https://www.wildberries.ru/product/149763240")).toBe(nm);
  });
  it("returns null for non-WB hosts and pages without an article", () => {
    expect(extractNm("https://www.ozon.ru/product/149763240")).toBeNull();
    expect(extractNm("https://www.wildberries.ru/brands/kindle")).toBeNull();
    expect(extractNm("nope")).toBeNull();
  });
});

describe("basketHost", () => {
  it("maps vol ranges to basket numbers", () => {
    const cases: Array<[number, string]> = [
      [0, "basket-01"], [143, "basket-01"], [144, "basket-02"], [287, "basket-02"], [288, "basket-03"],
      [431, "basket-03"], [432, "basket-04"], [719, "basket-04"], [720, "basket-05"], [1007, "basket-05"],
      [1008, "basket-06"], [1061, "basket-06"], [1062, "basket-07"], [1115, "basket-07"], [1116, "basket-08"],
      [1169, "basket-08"], [1170, "basket-09"], [1313, "basket-09"], [1314, "basket-10"], [1601, "basket-10"],
      [1602, "basket-11"], [1655, "basket-11"], [1656, "basket-12"], [1919, "basket-12"], [1920, "basket-13"],
      [2045, "basket-13"], [2046, "basket-14"], [2189, "basket-14"], [2190, "basket-15"], [2405, "basket-15"],
      [2406, "basket-16"], [2621, "basket-16"], [2622, "basket-17"], [2837, "basket-17"], [2838, "basket-18"],
      [3053, "basket-18"], [3054, "basket-19"], [3269, "basket-19"], [3270, "basket-20"], [3485, "basket-20"],
      [3486, "basket-21"], [11675, "basket-43"],
    ];
    for (const [vol, host] of cases) {
      expect(basketHost(vol * 1e5 + 12345), `vol ${vol}`).toBe(`${host}.wbbasket.ru`);
    }
  });
  it("interpolates baskets beyond the table (anchor: vol 11675 -> basket 43)", () => {
    expect(guessBasket(11675)).toBe(43);
    expect(basketHost(1167502010)).toBe("basket-43.wbbasket.ru");
  });
  it("builds the big image URL", () => {
    expect(wbImageUrl(nm)).toBe("https://basket-10.wbbasket.ru/vol1497/part149763/149763240/images/big/1.webp");
    expect(wbImageUrl(nm, 12)).toBe("https://basket-12.wbbasket.ru/vol1497/part149763/149763240/images/big/1.webp");
  });
});

describe("resolveWbImage", () => {
  it("returns the guessed URL when the CDN answers 200", async () => {
    const head: HeadFetcher = async () => 200;
    await expect(resolveWbImage(nm, head)).resolves.toBe(wbImageUrl(nm));
  });
  it("probes neighbouring baskets when the guess is a 404", async () => {
    const good = wbImageUrl(nm, 12);
    const head: HeadFetcher = async (u) => (u === good ? 200 : 404);
    await expect(resolveWbImage(nm, head)).resolves.toBe(good);
  });
  it("returns null when nothing answers", async () => {
    const head: HeadFetcher = async () => null;
    await expect(resolveWbImage(nm, head)).resolves.toBeNull();
  });
});

describe("mapWbV2 / mapWbV1", () => {
  it("maps the v2 payload with brand prefix and kopeck price", () => {
    const p = mapWbV2(v2, nm);
    expect(p).toMatchObject({
      title: "Kindle Электронная книга Paperwhite 16 ГБ",
      price: 13499,
      currency: "RUB",
      source: "wb",
      confidence: "high",
      image: wbImageUrl(nm),
      url: "https://www.wildberries.ru/catalog/149763240/detail.aspx",
    });
  });
  it("does not duplicate the brand when the name already starts with it", () => {
    expect(mapWbV2(v2NoPrice, nm)?.title).toBe("Kindle Paperwhite 16 ГБ");
  });
  it("returns price null when sizes carry no price", () => {
    expect(mapWbV2(v2NoPrice, nm)?.price).toBeNull();
  });
  it("maps the v1 payload via salePriceU", () => {
    expect(mapWbV1(v1, nm)).toMatchObject({ title: "Kindle Электронная книга Paperwhite 16 ГБ", price: 13499 });
  });
  it("returns null for empty or malformed payloads", () => {
    expect(mapWbV2({}, nm)).toBeNull();
    expect(mapWbV2({ data: { products: [] } }, nm)).toBeNull();
    expect(mapWbV2({ data: { products: [{ id: nm }] } }, nm)).toBeNull();
    expect(mapWbV2(null, nm)).toBeNull();
    expect(mapWbV1("garbage", nm)).toBeNull();
  });
});

function fakeFetcher(routes: Record<string, Partial<FetchTextResult> | null>): TextFetcher & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([k]) => url.startsWith(k));
    if (!hit || hit[1] == null) return null;
    return { status: 200, contentType: "application/json", body: "", url, ...hit[1] };
  }) as TextFetcher & { calls: string[] };
  f.calls = calls;
  return f;
}

describe("parseWb", () => {
  const url = "https://www.wildberries.ru/catalog/149763240/detail.aspx";
  const headOk: HeadFetcher = async () => 200;

  it("uses v4 when it answers and verifies the image on the CDN", async () => {
    const f = fakeFetcher({ "https://card.wb.ru/cards/v4/": { body: JSON.stringify(v4) } });
    const p = await parseWb("https://www.wildberries.ru/catalog/1167502010/detail.aspx", f, headOk);
    expect(p).toMatchObject({ price: 1034, source: "wb", confidence: "high" });
    expect(p?.title).toContain("Kindle Paperwhite");
    expect(p?.image).toBe("https://basket-43.wbbasket.ru/vol11675/part1167502/1167502010/images/big/1.webp");
    expect(f.calls).toHaveLength(1);
  });
  it("falls back to v2 when v4 is a 404", async () => {
    const f = fakeFetcher({ "https://card.wb.ru/cards/v2/": { body: JSON.stringify(v2) } });
    const p = await parseWb(url, f, headOk);
    expect(p?.price).toBe(13499);
    expect(p?.url).toBe(url);
    expect(f.calls).toHaveLength(2);
  });
  it("sets image null when no basket answers", async () => {
    const f = fakeFetcher({ "https://card.wb.ru/cards/v4/": { body: JSON.stringify(v4) } });
    const p = await parseWb("https://www.wildberries.ru/catalog/1167502010/detail.aspx", f, async () => 404);
    expect(p?.image).toBeNull();
  });
  it("falls back to v1 when v4 and v2 return an empty body", async () => {
    const f = fakeFetcher({
      "https://card.wb.ru/cards/v4/": { body: "" },
      "https://card.wb.ru/cards/v2/": { body: "" },
      "https://card.wb.ru/cards/v1/": { body: JSON.stringify(v1) },
    });
    const p = await parseWb(url, f, headOk);
    expect(p?.price).toBe(13499);
    expect(f.calls).toHaveLength(3);
  });
  it("falls back to the HTML page's OG tags when both APIs are empty", async () => {
    const f = fakeFetcher({
      "https://card.wb.ru/": { body: "not json at all" },
      "https://www.wildberries.ru/catalog/": {
        contentType: "text/html; charset=utf-8",
        body: '<html><head><meta property="og:title" content="Kindle Paperwhite"><meta property="product:price:amount" content="13499"></head></html>',
      },
    });
    const p = await parseWb(url, f, headOk);
    expect(p).toMatchObject({ title: "Kindle Paperwhite", price: 13499, source: "wb", image: wbImageUrl(nm) });
    expect(f.calls).toHaveLength(4);
  });
  it("returns null, never throws, when everything fails", async () => {
    const f = fakeFetcher({});
    await expect(parseWb(url, f, headOk)).resolves.toBeNull();
    const throwing: TextFetcher = async () => { throw new Error("boom"); };
    await expect(parseWb(url, throwing, headOk)).resolves.toBeNull();
  });
  it("returns null for a WB URL without an article", async () => {
    const f = fakeFetcher({});
    await expect(parseWb("https://www.wildberries.ru/brands/kindle", f, headOk)).resolves.toBeNull();
    expect(f.calls).toHaveLength(0);
  });
});
