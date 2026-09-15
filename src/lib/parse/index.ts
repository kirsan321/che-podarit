import { fetchText, type TextFetcher } from "./http";
import { parseOg } from "./og";
import type { ParsedProduct } from "./types";
import { detectSource, normalizeUrl } from "./url";
import { parseWb } from "./wb";
import { queryFromSlug, searchWb, type WbCandidate } from "./wbSearch";

export type { ParsedProduct, ProductSource } from "./types";
export { normalizeUrl, detectSource, isBlockedHost } from "./url";

/**
 * Entry point: normalizes the URL, guards against SSRF, routes to a
 * marketplace adapter and falls back to Open Graph. Never throws.
 */
export async function parseProductUrl(input: string, fetcher: TextFetcher = fetchText): Promise<ParsedProduct | null> {
  const url = normalizeUrl(input);
  if (!url) return null;
  try {
    const source = detectSource(url);
    let product = source === "wb" ? await parseWb(url, fetcher) : await parseOg(url, fetcher);
    if (!product && (source === "ozon" || source === "ym") && SCRAPER_TEMPLATE) product = await parseOg(scraperUrl(url), fetcher, { timeoutMs: 15_000 });
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
export async function parseWithCandidates(input: string, title: string | null, fetcher: TextFetcher = fetchText): Promise<ParseResult> {
  const product = await parseProductUrl(input, fetcher);
  const complete = !!product && product.price != null && !!product.image;
  const url = normalizeUrl(input);
  const source = url ? detectSource(url) : "other";
  if (complete || source === "wb") return { product, candidates: [], query: null };
  const query = (title && title.trim().length >= 3 ? title.trim() : null) ?? product?.title ?? (url ? queryFromSlug(url) : null);
  if (!query) return { product, candidates: [], query: null };
  const candidates = await searchWb(query, fetcher);
  return { product, candidates, query };
}
