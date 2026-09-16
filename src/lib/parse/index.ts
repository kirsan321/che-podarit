import { fetchText, resolveRedirect, type RedirectResolver, type TextFetcher } from "./http";
import { parseOg } from "./og";
import type { ParsedProduct } from "./types";
import { detectSource, normalizeUrl } from "./url";
import { parseWb } from "./wb";
import { queryFromSlug, searchWbMulti, type WbCandidate } from "./wbSearch";
import { detranslit, slugToTitle } from "./translit";

export type { ParsedProduct, ProductSource } from "./types";
export { normalizeUrl, detectSource, isBlockedHost } from "./url";

/**
 * Entry point: normalizes the URL, guards against SSRF, routes to a
 * marketplace adapter and falls back to Open Graph. Never throws.
 */
/** ozon.ru/t/xxx and market.yandex.ru/cc/xxx redirect once to the full product URL, whose slug carries the product name. */
export function isShortLink(url: string): boolean {
  return /^https?:\/\/(www\.)?ozon\.ru\/t\/[A-Za-z0-9_-]+/.test(url) || /^https?:\/\/market\.yandex\.ru\/cc\/[A-Za-z0-9_-]+/.test(url);
}

/** Expands a marketplace short link to its canonical product URL (tracking stripped). Returns the input when not a short link or unresolvable. */
export async function expandShortLink(url: string, resolver: RedirectResolver = resolveRedirect): Promise<string> {
  if (!isShortLink(url)) return url;
  const target = await resolver(url);
  const normalized = target ? normalizeUrl(target) : null;
  if (!normalized) return url;
  try {
    const u = new URL(normalized);
    if (detectSource(normalized) === "ozon" || detectSource(normalized) === "ym") u.search = "";
    return u.toString();
  } catch {
    return normalized;
  }
}

/** Product slug from an Ozon (/product/<slug>-<id>/) or Yandex Market (/card/<slug>/<id>, /product--<slug>/<id>) URL. */
export function slugFromUrl(url: string): string | null {
  try {
    const segs = new URL(url).pathname.split("/").filter(Boolean);
    const cand = segs.map((s) => s.replace(/^(product|card)--?/i, "")).filter((s) => /[a-z]/i.test(s) && s.replace(/[-_]/g, " ").trim().split(" ").length >= 2);
    return cand.sort((a, b) => b.length - a.length)[0] ?? null;
  } catch {
    return null;
  }
}

export async function parseProductUrl(input: string, fetcher: TextFetcher = fetchText, resolver: RedirectResolver = resolveRedirect): Promise<ParsedProduct | null> {
  const normalized = normalizeUrl(input);
  if (!normalized) return null;
  const url = await expandShortLink(normalized, resolver);
  try {
    const source = detectSource(url);
    let product = source === "wb" ? await parseWb(url, fetcher) : await parseOg(url, fetcher);
    if (!product && (source === "ozon" || source === "ym") && SCRAPER_TEMPLATE) product = await parseOg(scraperUrl(url), fetcher, { timeoutMs: 15_000 });
    if (!product && (source === "ozon" || source === "ym")) {
      // Anti-bot pages: the URL slug still carries the product name.
      const slug = slugFromUrl(url);
      const title = slug ? slugToTitle(slug) : "";
      if (title) product = { title, image: null, price: null, currency: "RUB", url, source, confidence: "low" };
    }
    if (!product) return null;
    return { ...product, url, source };
  } catch {
    return null;
  }
}

/**
 * Optional scraping service for anti-bot marketplaces (Ozon, Yandex Market).
 * SCRAPER_URL_TEMPLATE example: https://api.scraperapi.com/?api_key=KEY&country_code=ru&render=true&url={url}
 */
const SCRAPER_TEMPLATE = process.env.SCRAPER_URL_TEMPLATE?.trim() || null;
function scraperUrl(url: string): string {
  return SCRAPER_TEMPLATE!.replace("{url}", encodeURIComponent(url));
}

export interface ParseResult {
  product: ParsedProduct | null;
  /** WB matches for the title when the page itself could not be parsed (or has no price/image). */
  candidates: WbCandidate[];
  /** What the candidates were searched by. */
  query: string | null;
}

/** Parses the URL and, when the product is incomplete, suggests WB matches by the given title or the URL slug. */
export async function parseWithCandidates(input: string, title: string | null, fetcher: TextFetcher = fetchText, resolver: RedirectResolver = resolveRedirect): Promise<ParseResult> {
  const product = await parseProductUrl(input, fetcher, resolver);
  const complete = !!product && product.price != null && !!product.image;
  const url = product?.url ?? normalizeUrl(input);
  const source = url ? detectSource(url) : "other";
  if (complete || source === "wb") return { product, candidates: [], query: null };
  const shared = title && title.trim().length >= 3 ? title.trim() : null;
  const slug = url ? slugFromUrl(url) ?? queryFromSlug(url) : null;
  const queries: string[] = [];
  if (shared) queries.push(shared);
  if (slug) { const raw = slug.replace(/[-_]+/g, " ").replace(/\b\d{6,}\b/g, "").trim(); queries.push(detranslit(raw), raw); }
  if (!queries.length && product?.title) queries.push(product.title);
  if (!queries.length) return { product, candidates: [], query: null };
  const candidates = await searchWbMulti(queries, fetcher);
  return { product, candidates, query: queries[0] };
}
