/**
 * Tiny per-key store backed by sessionStorage (in-memory fallback), shaped for useSyncExternalStore.
 * Snapshots are raw JSON strings so they compare by value; `undefined` means "not on the client yet".
 * Change notifications go through a window event, so there is no module-level state to lose on HMR.
 */
const EVENT = "give-store-change";
const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function readRaw(key: string): string | null {
  const s = storage();
  if (s) {
    try { return s.getItem(key); } catch { /* fall through */ }
  }
  return memory.get(key) ?? null;
}

export function serverSnapshot(): undefined {
  return undefined;
}

export function writeRaw(key: string, value: string): void {
  const s = storage();
  let ok = false;
  if (s) {
    try { s.setItem(key, value); ok = true; } catch { /* quota or private mode */ }
  }
  if (!ok) memory.set(key, value);
  window.dispatchEvent(new Event(EVENT));
}
