import { describe, expect, it } from "vitest";
import { expandShortLink, isShortLink, parseProductUrl, parseWithCandidates, slugFromUrl } from "../index";
import { isAntiBotPage } from "../og";
import type { TextFetcher } from "../http";

describe("short links and slugs", () => {
  it("recognizes Ozon and Yandex Market short links", () => {
    expect(isShortLink("https://ozon.ru/t/1fTtPhU")).toBe(true);
    expect(isShortLink("https://market.yandex.ru/cc/B5PCVv")).toBe(true);
    expect(isShortLink("https://www.ozon.ru/product/x-1/")).toBe(false);
  });
  it("expands a short link and strips tracking", async () => {
    const r = async () => "https://www.ozon.ru/product/komplekt-odezhdy-lafamily-987874603/?from=share_web&sh=9SQ&short=1fTtPhU";
    expect(await expandShortLink("https://ozon.ru/t/1fTtPhU", r)).toBe("https://www.ozon.ru/product/komplekt-odezhdy-lafamily-987874603/");
    expect(await expandShortLink("https://ozon.ru/t/1fTtPhU", async () => null)).toBe("https://ozon.ru/t/1fTtPhU");
  });
  it("extracts the slug from Ozon and Yandex Market URLs", () => {
    expect(slugFromUrl("https://www.ozon.ru/product/apple-smartfon-iphone-17-pro-max-4875516340/")).toBe("apple-smartfon-iphone-17-pro-max-4875516340");
    expect(slugFromUrl("https://market.yandex.ru/card/zhenskaya-kurtka-uteplennaya-siniy-xs-int/5830603224")).toBe("zhenskaya-kurtka-uteplennaya-siniy-xs-int");
    expect(slugFromUrl("https://market.yandex.ru/product--kindle-paperwhite/1791212489")).toBe("kindle-paperwhite");
    expect(slugFromUrl("https://ozon.ru/t/abc")).toBeNull();
  });
  it("treats captcha pages as non-products", () => {
    expect(isAntiBotPage('<html><head><script src="https://smartcaptcha.yandexcloud.net/captcha.js"></script></head></html>', "https://market.yandex.ru/x")).toBe(true);
    expect(isAntiBotPage("<html><title>Товар</title></html>", "https://www.ozon.ru/product/x/?__rr=2")).toBe(true);
    expect(isAntiBotPage("<html><title>Товар</title></html>", "https://www.ozon.ru/product/x/")).toBe(false);
  });
  it("falls back to a low-confidence product from the slug when the page is anti-bot", async () => {
    const f: TextFetcher = async (url) => ({ status: 200, contentType: "text/html", body: '<html><head><meta property="og:title" content="Яндекс"><script src="smartcaptcha.js"></script></head></html>', url });
    const p = await parseProductUrl("https://market.yandex.ru/cc/B5PDdd", f, async () => "https://market.yandex.ru/card/zhenskaya-kurtka-uteplennaya-siniy-xs-int/5830603224?offerid=1");
    expect(p).toMatchObject({ source: "ym", confidence: "low", price: null, url: "https://market.yandex.ru/card/zhenskaya-kurtka-uteplennaya-siniy-xs-int/5830603224" });
    expect(p?.title).toBe("Женская куртка утепленная синий xs int");
  });
  it("searches WB with the shared title first, then the Cyrillic and raw slug", async () => {
    const queries: string[] = [];
    const f: TextFetcher = async (url) => {
      if (url.includes("search.wb.ru")) { queries.push(decodeURIComponent(url.match(/query=([^&]+)/)![1])); return { status: 200, contentType: "application/json", body: '{"products":[]}', url }; }
      return null;
    };
    const r = await parseWithCandidates("https://www.ozon.ru/product/komplekt-odezhdy-lafamily-987874603/", "Комплект одежды LaFamily", f, async () => null);
    expect(r.product?.confidence).toBe("low");
    expect(queries).toEqual(["Комплект одежды LaFamily", "komplekt одежды lafamily", "komplekt odezhdy lafamily"]);
  });
});
