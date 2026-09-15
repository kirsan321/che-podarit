import { fetchHead, fetchText, type HeadFetcher, type TextFetcher } from "./http";
import { parseOg } from "./og";
import type { ParsedProduct } from "./types";

/** Extracts the Wildberries article (nm) from a product URL. */
export function extractNm(url: string): number | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const isWb = host === "wildberries.ru" || host.endsWith(".wildberries.ru") || host === "wb.ru" || host.endsWith(".wb.ru");
  if (!isWb) return null;
  const catalog = /\/catalog\/(\d{3,12})(?:\/|$)/.exec(u.pathname);
  if (catalog) return Number(catalog[1]);
  const q = u.searchParams.get("nm") ?? u.searchParams.get("card");
  if (q && /^\d{3,12}$/.test(q)) return Number(q);
  const seg = u.pathname.split("/").find((s) => /^\d{5,12}$/.test(s));
  return seg ? Number(seg) : null;
}

// vol upper bound (inclusive) -> basket number. Sorted ascending.
const BASKET_RANGES: Array<[number, number]> = [
  [143, 1], [287, 2], [431, 3], [719, 4], [1007, 5], [1061, 6], [1115, 7], [1169, 8],
  [1313, 9], [1601, 10], [1655, 11], [1919, 12], [2045, 13], [2189, 14], [2405, 15],
  [2621, 16], [2837, 17], [3053, 18], [3269, 19], [3485, 20],
];

// Beyond the table, baskets grow roughly linearly. Anchor observed 2026-09-15: vol 11675 -> basket 43.
const LAST_TABLE_VOL = 3485;
const LAST_TABLE_BASKET = 20;
const VOLS_PER_BASKET = (11675 - LAST_TABLE_VOL) / (43 - LAST_TABLE_BASKET);

/** Best-guess basket number for a vol; verified against the CDN by resolveWbImage. */
export function guessBasket(vol: number): number {
  const hit = BASKET_RANGES.find(([max]) => vol <= max);
  if (hit) return hit[1];
  return LAST_TABLE_BASKET + Math.ceil((vol - LAST_TABLE_VOL) / VOLS_PER_BASKET);
}

export function basketHost(nm: number, basket: number = guessBasket(Math.floor(nm / 1e5))): string {
  return `basket-${String(basket).padStart(2, "0")}.wbbasket.ru`;
}

export function wbImageUrl(nm: number, basket?: number): string {
  const vol = Math.floor(nm / 1e5);
  const part = Math.floor(nm / 1e3);
  return `https://${basketHost(nm, basket)}/vol${vol}/part${part}/${nm}/images/big/1.webp`;
}

/**
 * Finds the image URL that actually exists on the CDN: tries the guessed basket first,
 * then its neighbours in parallel. Returns null when nothing answers 200.
 */
export async function resolveWbImage(nm: number, head: HeadFetcher = fetchHead): Promise<string | null> {
  const guess = guessBasket(Math.floor(nm / 1e5));
  const first = wbImageUrl(nm, guess);
  if ((await head(first)) === 200) return first;
  const candidates = [-1, 1, -2, 2, -3, 3].map((d) => guess + d).filter((b) => b >= 1 && b <= 99);
  const results = await Promise.all(candidates.map(async (b) => ((await head(wbImageUrl(nm, b))) === 200 ? wbImageUrl(nm, b) : null)));
  return results.find((r) => r) ?? null;
}

export function wbCanonicalUrl(nm: number): string {
  return `https://www.wildberries.ru/catalog/${nm}/detail.aspx`;
}

type Json = Record<string, unknown>;

function firstProduct(json: unknown, nm: number): Json | null {
  if (!json || typeof json !== "object") return null;
  const data = (json as Json).data;
  const products = data && typeof data === "object" ? (data as Json).products : (json as Json).products;
  if (!Array.isArray(products) || products.length === 0) return null;
  const byId = products.find((p) => p && typeof p === "object" && Number((p as Json).id) === nm);
  const p = byId ?? products[0];
  return p && typeof p === "object" ? (p as Json) : null;
}

function buildTitle(p: Json): string | null {
  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (!name) return null;
  const brand = typeof p.brand === "string" ? p.brand.trim() : "";
  const title = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;
  return title.slice(0, 200);
}

function kopecksToRub(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) / 100 : null;
}

function product(nm: number, title: string, price: number | null, url: string): ParsedProduct {
  return { title, image: wbImageUrl(nm), price, currency: "RUB", url, source: "wb", confidence: "high" };
}

/** Maps a card.wb.ru v2 payload to a product. Pure. */
export function mapWbV2(json: unknown, nm: number, url: string = wbCanonicalUrl(nm)): ParsedProduct | null {
  const p = firstProduct(json, nm);
  if (!p) return null;
  const title = buildTitle(p);
  if (!title) return null;
  const sizes = Array.isArray(p.sizes) ? (p.sizes as Json[]) : [];
  let price: number | null = null;
  for (const s of sizes) {
    const pr = s && typeof s === "object" ? (s.price as Json | undefined) : undefined;
    price = kopecksToRub(pr?.product ?? pr?.total ?? pr?.basic);
    if (price != null) break;
  }
  return product(nm, title, price, url);
}

/** Maps a card.wb.ru v1 payload to a product. Pure. */
export function mapWbV1(json: unknown, nm: number, url: string = wbCanonicalUrl(nm)): ParsedProduct | null {
  const p = firstProduct(json, nm);
  if (!p) return null;
  const title = buildTitle(p);
  if (!title) return null;
  const price = kopecksToRub(p.salePriceU ?? p.priceU);
  return product(nm, title, price, url);
}

function safeJson(body: string): unknown {
  const t = body.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

const CARD_QUERY = "appType=1&curr=rub&dest=-1257786&spp=30";

export type WbCardVersion = "v4" | "v2" | "v1";

export function wbCardUrl(nm: number, version: WbCardVersion): string {
  return `https://card.wb.ru/cards/${version}/detail?${CARD_QUERY}&nm=${nm}`;
}

/**
 * Wildberries adapter: card API v4 (current; v2/v1 return 404 since 2026), then the HTML page's Open Graph tags.
 * v4 has the same shape as v2 (sizes[].price.product in kopecks). Image host is verified against the CDN.
 * WB endpoints may return an empty body or block some IPs; all of that yields null.
 */
export async function parseWb(url: string, fetcher: TextFetcher = fetchText, head: HeadFetcher = fetchHead): Promise<ParsedProduct | null> {
  const nm = extractNm(url);
  if (nm == null) return null;
  try {
    for (const version of ["v4", "v2", "v1"] as const) {
      const res = await fetcher(wbCardUrl(nm, version), { accept: "application/json,*/*;q=0.5", maxBytes: 512_000, tlsProfile: "browser" });
      if (!res || res.status !== 200) continue;
      const json = safeJson(res.body);
      if (!json) continue;
      const mapped = version === "v1" ? mapWbV1(json, nm, url) : mapWbV2(json, nm, url);
      if (mapped) return { ...mapped, image: await resolveWbImage(nm, head) };
    }
    const og = await parseOg(wbCanonicalUrl(nm), fetcher);
    if (og) return { ...og, url, source: "wb", image: og.image ?? wbImageUrl(nm) };
    return null;
  } catch {
    return null;
  }
}
