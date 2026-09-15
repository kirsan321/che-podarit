/** Turns the title/text/url a share sheet sends into a product URL and a clean title. Pure. */
export interface SharePayload { title?: string | null; text?: string | null; url?: string | null }
export interface ShareResult { url: string | null; title: string | null }

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

// Prefixes the marketplace apps prepend to the shared text.
const NOISE_PREFIX = [
  /^товар на ozon\s*[:\-–—]?\s*/i,
  /^ozon\s*[:\-–—]\s*/i,
  /^смотри(те)?,? что я нашл[аи] на (wildberries|wb|ozon|яндекс маркете|маркете)\s*[:\-–—]?\s*/i,
  /^(wildberries|wb|ozon|яндекс\.?\s*маркет|яндекс маркет|lamoda)\s*[:\-–—]\s*/i,
  /^посмотри(те)?\s*[:\-–—]?\s*/i,
];
const NOISE_SUFFIX = [
  /\s*[-–—|]\s*(купить|цена|отзывы|характеристики)[^]*$/i,
  /\s*(на|в)\s+(wildberries|wb|ozon|яндекс маркете|маркете|lamoda)\s*\.?$/i,
  /\s*\|\s*[^|]*$/,
];

function cleanTitle(s: string): string | null {
  let t = s.replace(URL_RE, " ").replace(/\s+/g, " ").trim();
  for (const re of NOISE_PREFIX) t = t.replace(re, "");
  for (const re of NOISE_SUFFIX) t = t.replace(re, "");
  t = t.replace(/^[\s"«»'“”:,\-–—]+|[\s"«»'“”:,\-–—]+$/g, "").trim();
  if (t.length < 3) return null;
  return t.slice(0, 200);
}

export function parseSharePayload(p: SharePayload): ShareResult {
  const parts = [p.url, p.text, p.title].map((x) => (x ?? "").trim());
  let url: string | null = null;
  for (const part of parts) {
    const m = part.match(URL_RE);
    if (m && m.length) { url = m[0].replace(/[),.;!?]+$/, ""); break; }
  }
  // Prefer the text (usually "Название … https://…"), then the title.
  const title = cleanTitle(p.text ?? "") ?? cleanTitle(p.title ?? "");
  return { url, title };
}
