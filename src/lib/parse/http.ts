import { normalizeUrl } from "./url";

export interface FetchTextResult {
  status: number;
  contentType: string;
  body: string;
  /** URL after redirects. */
  url: string;
}

export interface FetchTextOptions {
  /** "browser": use node:https with a browser-like TLS cipher list. Some CDNs (WB) reject Node's default TLS fingerprint with 403. */
  tlsProfile?: "default" | "browser";
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
  if (opts.tlsProfile === "browser") return fetchTextBrowserTls(url, opts);
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

/** HEAD request; returns the HTTP status or null on network error/timeout. */
export type HeadFetcher = (url: string) => Promise<number | null>;
export const fetchHead: HeadFetcher = async (url) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": UA } });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
};

// Browser-like TLS profile. Observed 2026-09-15: card.wb.ru and search.wb.ru answer 403 to Node's default
// cipher suite order (undici/OpenSSL) but 200 to this list, regardless of IP or headers.
const BROWSER_CIPHERS = [
  "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-RSA-AES128-GCM-SHA256", "ECDHE-ECDSA-AES256-GCM-SHA384",
  "ECDHE-RSA-AES256-GCM-SHA384", "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-CHACHA20-POLY1305",
].join(":");

async function fetchTextBrowserTls(url: string, opts: FetchTextOptions): Promise<FetchTextResult | null> {
  const { request } = await import("node:https");
  const timeoutMs = opts.timeoutMs ?? 4000;
  const maxBytes = opts.maxBytes ?? 1_000_000;
  const accept = opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8";
  let current = normalizeUrl(url);
  for (let hop = 0; current && hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:") return null;
    const result = await new Promise<{ status: number; contentType: string; location: string | null; bytes: Uint8Array } | null>((resolve) => {
      const req = request(
        {
          hostname: u.hostname, path: u.pathname + u.search, method: "GET",
          headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8" },
          ciphers: BROWSER_CIPHERS, ecdhCurve: "X25519:P-256:P-384", timeout: timeoutMs,
        },
        (res) => {
          const chunks: Uint8Array[] = []; let total = 0;
          res.on("data", (c: Uint8Array) => { if (total < maxBytes) { chunks.push(c); total += c.length; } else res.destroy(); });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, contentType: res.headers["content-type"] ?? "", location: res.headers.location ?? null, bytes: concat(chunks, Math.min(total, maxBytes)) }));
          res.on("error", () => resolve(null));
        },
      );
      req.on("timeout", () => req.destroy());
      req.on("error", () => resolve(null));
      req.end();
    });
    if (!result) return null;
    if (result.status >= 300 && result.status < 400) {
      if (!result.location) return null;
      try { current = normalizeUrl(new URL(result.location, current).toString()); } catch { return null; }
      continue;
    }
    return { status: result.status, contentType: result.contentType, body: decode(result.bytes, detectCharset(result.contentType, result.bytes)), url: current };
  }
  return null;
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size); let o = 0;
  for (const c of chunks) { const n = Math.min(c.length, size - o); out.set(c.subarray(0, n), o); o += n; if (o >= size) break; }
  return out;
}
