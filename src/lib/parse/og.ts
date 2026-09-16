import { fetchText, type TextFetcher } from "./http";
import type { ParsedProduct } from "./types";
import { detectSource } from "./url";

export interface OgData {
  title: string | null;
  titleFromMeta: boolean;
  image: string | null;
  price: number | null;
  currency: string | null;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function cleanText(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = decodeEntities(s).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 200) : null;
}

export function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[\s  ]/g, "").replace(/[^\d.,]/g, "");
  if (!s) return null;
  // "4 990,00" -> 4990.00 ; "4,990.00" -> 4990.00 ; "4990" -> 4990
  let n: string;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) n = s.replace(/\./g, "").replace(",", ".");
  else n = s.replace(/,/g, "");
  const num = Number(n);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) {
    const key = m[1].toLowerCase();
    if (!(key in out)) out[key] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

/** Collects <meta> tags into a map keyed by property/name/itemprop (first wins). */
function collectMeta(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const a = parseAttrs(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    const content = a.content;
    if (key && content != null && !map.has(key)) map.set(key, content);
  }
  return map;
}

type Json = unknown;

function asArray(v: Json): Json[] {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

function typeMatches(node: Record<string, Json>, type: string): boolean {
  return asArray(node["@type"]).some((t) => typeof t === "string" && t.toLowerCase() === type.toLowerCase());
}

function findProduct(node: Json, depth = 0): Record<string, Json> | null {
  if (depth > 6 || node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n, depth + 1);
      if (p) return p;
    }
    return null;
  }
  const obj = node as Record<string, Json>;
  if (typeMatches(obj, "Product")) return obj;
  for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) {
    if (key in obj) {
      const p = findProduct(obj[key], depth + 1);
      if (p) return p;
    }
  }
  return null;
}

function jsonLdProduct(html: string): { title: string | null; image: string | null; price: number | null; currency: string | null } | null {
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let data: Json;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const p = findProduct(data);
    if (!p) continue;
    const offers = asArray(p.offers).find((o) => o && typeof o === "object") as Record<string, Json> | undefined;
    const price = offers ? parsePrice(offers.price ?? offers.lowPrice) : null;
    const currency = offers && typeof offers.priceCurrency === "string" ? offers.priceCurrency : null;
    const img = asArray(p.image)[0];
    const image = typeof img === "string" ? img : img && typeof img === "object" && typeof (img as Record<string, Json>).url === "string" ? ((img as Record<string, Json>).url as string) : null;
    return { title: typeof p.name === "string" ? p.name : null, image, price, currency };
  }
  return null;
}

function resolveUrl(candidate: string | null, base: string): string | null {
  if (!candidate) return null;
  try {
    const u = new URL(decodeEntities(candidate).trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Pure HTML -> Open Graph / JSON-LD extraction. */
export function extractOg(html: string, baseUrl: string): OgData {
  const meta = collectMeta(html);
  const ld = jsonLdProduct(html);

  const metaTitle = cleanText(meta.get("og:title") ?? meta.get("twitter:title"));
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = metaTitle ?? cleanText(ld?.title) ?? cleanText(titleTag?.[1]);

  const linkImg = /<link\b[^>]*rel\s*=\s*["']?image_src["']?[^>]*>/i.exec(html);
  const image =
    resolveUrl(meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("twitter:image") ?? null, baseUrl) ??
    resolveUrl(ld?.image ?? null, baseUrl) ??
    resolveUrl(linkImg ? parseAttrs(linkImg[0]).href ?? null : null, baseUrl);

  let price = parsePrice(meta.get("product:price:amount") ?? meta.get("og:price:amount") ?? meta.get("price") ?? null);
  let currency = meta.get("product:price:currency") ?? meta.get("og:price:currency") ?? meta.get("pricecurrency") ?? null;
  if (price == null) {
    const itemprop = /<[a-z]+\b[^>]*itemprop\s*=\s*["']?price["']?[^>]*\bcontent\s*=\s*["']([^"']+)["']/i.exec(html);
    price = parsePrice(itemprop?.[1] ?? null);
  }
  if (price == null && ld?.price != null) {
    price = ld.price;
    currency = ld.currency ?? currency;
  }

  return { title, titleFromMeta: metaTitle != null, image, price, currency: currency ? currency.toUpperCase() : null };
}

export function ogToProduct(og: OgData, url: string): ParsedProduct | null {
  if (!og.title) return null;
  const rubles = og.currency == null || og.currency === "RUB" || og.currency === "RUR";
  const price = rubles ? og.price : null;
  return {
    title: og.title,
    image: og.image,
    price,
    currency: "RUB",
    url,
    source: detectSource(url),
    confidence: og.titleFromMeta && price != null ? "high" : "low",
  };
}

function looksLikeHtml(contentType: string, body: string): boolean {
  if (/text\/html|application\/xhtml/i.test(contentType)) return true;
  if (contentType && !/^text\//i.test(contentType)) return false;
  return /<(html|head|meta|title)\b/i.test(body.slice(0, 4096));
}

/** Fetches any page and extracts a product from Open Graph / JSON-LD. Never throws. */
export async function parseOg(url: string, fetcher: TextFetcher = fetchText, fetchOpts: { timeoutMs?: number } = {}): Promise<ParsedProduct | null> {
  try {
    const res = await fetcher(url, fetchOpts);
    if (!res || res.status < 200 || res.status >= 300 || !res.body) return null;
    if (!looksLikeHtml(res.contentType, res.body)) return null;
    if (isAntiBotPage(res.body, res.url)) return null;
    return ogToProduct(extractOg(res.body, res.url), url);
  } catch {
    return null;
  }
}

/** Captcha / anti-bot interstitials carry og tags of the site itself; never treat them as a product. */
export function isAntiBotPage(html: string, finalUrl: string): boolean {
  if (/__rr=\d/.test(finalUrl)) return true;
  const head = html.slice(0, 60_000);
  return /smartcaptcha|showcaptcha|captcha-container|class="captcha|id="captcha|Подтвердите, что вы не робот|Доступ ограничен|antibot|cf-challenge|just a moment/i.test(head);
}
