import type { ProductSource } from "./types";

// Query params that carry no product identity, only tracking.
const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "yclid", "ymclid", "_openstat", "mc_cid", "mc_eid",
  "igshid", "ttclid", "twclid", "srsltid", "erid", "msclkid", "wbrid",
]);

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home", ".lan", ".arpa"];

function ipv4Parts(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((p) => p <= 255) ? parts : null;
}

function isPrivateIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true; // fe80::/10
  const mappedDotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
  if (mappedDotted) {
    const parts = ipv4Parts(mappedDotted[1]);
    return !parts || isPrivateIpv4(parts);
  }
  // Node canonicalizes ::ffff:127.0.0.1 to ::ffff:7f00:1
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }
  return false;
}

/** True when the host must never be fetched server-side (SSRF guard). */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host === "0.0.0.0") return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (host.startsWith("[") || host.includes(":")) return isPrivateIpv6(host);
  const v4 = ipv4Parts(host);
  if (v4) return isPrivateIpv4(v4);
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return true; // numeric shorthand for IPs
  if (!host.includes(".")) return true; // bare intranet names
  return false;
}

/**
 * Validates and canonicalizes a user-supplied URL.
 * Returns null for anything that is not a public http(s) URL.
 */
export function normalizeUrl(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw || raw.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  if (isBlockedHost(u.hostname)) return null;
  for (const key of [...u.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
      u.searchParams.delete(key);
    }
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  return u.toString();
}

export function detectSource(url: string): ProductSource {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  if (host === "wildberries.ru" || host.endsWith(".wildberries.ru") || host === "wb.ru" || host.endsWith(".wb.ru")) return "wb";
  if (host === "ozon.ru" || host.endsWith(".ozon.ru")) return "ozon";
  if (host === "market.yandex.ru" || host.endsWith(".market.yandex.ru")) return "ym";
  if (host === "lamoda.ru" || host.endsWith(".lamoda.ru")) return "lamoda";
  return "other";
}
