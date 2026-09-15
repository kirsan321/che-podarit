import { normalizeUrl } from "./url";

export interface FetchTextResult {
  status: number;
  contentType: string;
  body: string;
  /** URL after redirects. */
  url: string;
}

export interface FetchTextOptions {
  timeoutMs?: number;
  maxBytes?: number;
  accept?: string;
}

export type TextFetcher = (url: string, opts?: FetchTextOptions) => Promise<FetchTextResult | null>;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_REDIRECTS = 5;

async function readCapped(res: Response, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const slice = c.subarray(0, Math.max(0, Math.min(c.byteLength, out.byteLength - off)));
    out.set(slice, off);
    off += slice.byteLength;
    if (off >= out.byteLength) break;
  }
  return out;
}

function detectCharset(contentType: string, head: Uint8Array): string {
  const ct = /charset=["']?([\w-]+)/i.exec(contentType);
  if (ct) return ct[1];
  const ascii = new TextDecoder("latin1").decode(head.subarray(0, 4096));
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(ascii);
  return meta ? meta[1] : "utf-8";
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/**
 * Fetches a text body with a browser-like UA, hard timeout, body cap and
 * SSRF-checked manual redirects. Never throws: returns null on any failure.
 */
export const fetchText: TextFetcher = async (url, opts = {}) => {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const maxBytes = opts.maxBytes ?? 1_000_000;
  const accept = opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let current = normalizeUrl(url);
    for (let hop = 0; current && hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: ac.signal,
        cache: "no-store",
        headers: {
          "User-Agent": UA,
          Accept: accept,
          "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        res.body?.cancel().catch(() => {});
        if (!loc) return null;
        let next: string;
        try {
          next = new URL(loc, current).toString();
        } catch {
          return null;
        }
        current = normalizeUrl(next);
        continue;
      }
      const contentType = res.headers.get("content-type") ?? "";
      const bytes = await readCapped(res, maxBytes, ac.signal);
      const body = decode(bytes, detectCharset(contentType, bytes));
      return { status: res.status, contentType, body, url: current };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
