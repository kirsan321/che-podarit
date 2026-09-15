import { fetchText, type TextFetcher } from "./http";
import { parseOg } from "./og";
import type { ParsedProduct } from "./types";
import { detectSource, normalizeUrl } from "./url";
import { parseWb } from "./wb";

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
    const product = source === "wb" ? await parseWb(url, fetcher) : await parseOg(url, fetcher);
    if (!product) return null;
    return { ...product, url, source };
  } catch {
    return null;
  }
}
