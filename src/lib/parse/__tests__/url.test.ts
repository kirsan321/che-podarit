import { describe, expect, it } from "vitest";
import { detectSource, isBlockedHost, normalizeUrl } from "../url";

describe("normalizeUrl", () => {
  it("strips tracking params and hash, keeps meaningful params", () => {
    const out = normalizeUrl("https://www.Wildberries.ru/catalog/149763240/detail.aspx?size=1&utm_source=tg&utm_medium=x&fbclid=abc&yclid=1#top");
    expect(out).toBe("https://www.wildberries.ru/catalog/149763240/detail.aspx?size=1");
  });
  it("accepts plain http and https", () => {
    expect(normalizeUrl("http://example.com/a")).toBe("http://example.com/a");
    expect(normalizeUrl("  https://example.com/a  ")).toBe("https://example.com/a");
  });
  it("rejects non-http schemes, credentials, odd ports and garbage", () => {
    expect(normalizeUrl("ftp://example.com/x")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeUrl("https://user:pw@example.com/")).toBeNull();
    expect(normalizeUrl("https://example.com:8080/")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
  it("blocks private and local hosts (SSRF guard)", () => {
    for (const u of [
      "http://localhost/",
      "http://127.0.0.1/",
      "http://127.1.2.3/",
      "http://10.0.0.5/",
      "http://172.16.0.1/",
      "http://172.31.255.255/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://100.64.0.1/",
      "http://0.0.0.0/",
      "http://[::1]/",
      "http://[fe80::1]/",
      "http://[fd00::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://intranet/",
      "http://foo.local/",
      "http://db.internal/",
      "http://2130706433/",
      "http://0x7f000001/",
    ]) {
      expect(normalizeUrl(u), u).toBeNull();
    }
  });
  it("allows public IPs and hosts", () => {
    expect(isBlockedHost("8.8.8.8")).toBe(false);
    expect(isBlockedHost("172.32.0.1")).toBe(false);
    expect(isBlockedHost("www.ozon.ru")).toBe(false);
  });
});

describe("detectSource", () => {
  it("maps known marketplaces", () => {
    expect(detectSource("https://www.wildberries.ru/catalog/1/detail.aspx")).toBe("wb");
    expect(detectSource("https://wb.ru/x")).toBe("wb");
    expect(detectSource("https://www.ozon.ru/product/x-123")).toBe("ozon");
    expect(detectSource("https://market.yandex.ru/product--x/1")).toBe("ym");
    expect(detectSource("https://www.lamoda.ru/p/x/")).toBe("lamoda");
    expect(detectSource("https://shop.example.com/p/1")).toBe("other");
    expect(detectSource("https://notwildberries.ru/")).toBe("other");
  });
});
