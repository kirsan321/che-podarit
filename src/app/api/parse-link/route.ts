import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseWithCandidates, normalizeUrl } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory per-user limiter. Good enough for a single-instance prototype.
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function allow(userId: string): boolean {
  const now = Date.now();
  const b = buckets.get(userId);
  if (!b || b.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  b.count += 1;
  return b.count <= RATE_LIMIT;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const raw = body && typeof body === "object" ? (body as { url?: unknown }).url : undefined;
  const rawTitle = body && typeof body === "object" ? (body as { title?: unknown }).title : undefined;
  const title = typeof rawTitle === "string" ? rawTitle.slice(0, 200) : null;
  const url = typeof raw === "string" ? normalizeUrl(raw) : null;
  if (!url) return NextResponse.json({ ok: false, error: "invalid_url" }, { status: 400 });

  if (!allow(user.id)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const { product, candidates, query } = await parseWithCandidates(url, title);
  if (!product && !candidates.length) return NextResponse.json({ ok: false });
  return NextResponse.json({ ok: !!product, product, candidates, query });
}
