import { fetchHead, fetchText, type HeadFetcher, type TextFetcher } from "./http";
import { resolveWbImage, wbCanonicalUrl } from "./wb";

/** A WB product suggested as a match for a title we could not parse (Ozon, Yandex Market, ...). */
export interface WbCandidate {
  id: number;
  title: string;
  price: number | null;
  image: string | null;
  url: string;
}

type Json = Record<string, unknown>;

export function wbSearchUrl(query: string, limit = 5): string {
  const q = encodeURIComponent(query.trim().slice(0, 120));
  return `https://search.wb.ru/exactmatch/ru/common/v7/search?appType=1&curr=rub&dest=-1257786&query=${q}&resultset=catalog&limit=${limit}`;
}

/** Maps a search.wb.ru payload to candidates (no image resolution). Pure. */
export function mapWbSearch(json: unknown, max = 3): Omit<WbCandidate, "image">[] {
  if (!json || typeof json !== "object") return [];
  const j = json as Json;
  const data = j.data && typeof j.data === "object" ? (j.data as Json) : null;
  const products = Array.isArray(j.products) ? j.products : data && Array.isArray(data.products) ? data.products : [];
  const out: Omit<WbCandidate, "image">[] = [];
  for (const p of products as Json[]) {
    if (!p || typeof p !== "object") continue;
    const id = Number(p.id);
    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (!Number.isFinite(id) || !name) continue;
    const brand = typeof p.brand === "string" ? p.brand.trim() : "";
    const title = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;
    const sizes = Array.isArray(p.sizes) ? (p.sizes as Json[]) : [];
    let price: number | null = null;
    for (const s of sizes) {
      const pr = s && typeof s === "object" ? (s.price as Json | undefined) : undefined;
      const v = Number(pr?.product ?? pr?.total ?? pr?.basic);
      if (Number.isFinite(v) && v > 0) { price = Math.round(v) / 100; break; }
    }
    out.push({ id, title: title.slice(0, 200), price, url: wbCanonicalUrl(id) });
    if (out.length >= max) break;
  }
  return out;
}

/** Builds a search query from a marketplace URL slug, e.g. /product/krossovki-new-balance-530-belye-123/ -> "krossovki new balance 530 belye". */
export function queryFromSlug(url: string): string | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    let best = "";
    for (const s of segs) {
      const words = s.replace(/^(product|card|item)--?/i, "").replace(/[-_]+/g, " ").replace(/\b\d{6,}\b/g, "").replace(/\s+/g, " ").trim();
      if (words.split(" ").length >= 2 && words.length > best.length) best = words;
    }
    return best.length >= 5 ? best.slice(0, 120) : null;
  } catch {
    return null;
  }
}

/** Searches WB for a title and returns up to `max` candidates with CDN-verified images. Never throws. */
export async function searchWb(query: string, fetcher: TextFetcher = fetchText, head: HeadFetcher = fetchHead, max = 3): Promise<WbCandidate[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetcher(wbSearchUrl(q, 8), { accept: "application/json,*/*;q=0.5", maxBytes: 800_000, tlsProfile: "browser" });
    if (!res || res.status !== 200) return [];
    let json: unknown;
    try { json = JSON.parse(res.body); } catch { return []; }
    const mapped = mapWbSearch(json, max);
    return Promise.all(mapped.map(async (c) => ({ ...c, image: await resolveWbImage(c.id, head) })));
  } catch {
    return [];
  }
}

/** Runs several queries (e.g. Cyrillic and raw transliteration) and merges unique candidates in order. */
export async function searchWbMulti(queries: string[], fetcher: TextFetcher = fetchText, head: HeadFetcher = fetchHead, max = 3): Promise<WbCandidate[]> {
  const uniq = Array.from(new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 3)));
  if (!uniq.length) return [];
  const results = await Promise.all(uniq.map((q) => searchWb(q, fetcher, head, max)));
  const seen = new Set<number>();
  const out: WbCandidate[] = [];
  for (const list of results) for (const c of list) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); if (out.length >= max) return out; }
  return out;
}
