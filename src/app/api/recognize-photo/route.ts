import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchWbMulti } from "@/lib/parse/wbSearch";
import { queriesFromRecognition, recognizeProduct, titleFromRecognition, type ImageMediaType } from "@/lib/recognize/recognize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Per-user daily cap against abuse (in-memory, per instance: good enough for the prototype).
const DAILY_LIMIT = 30;
const usage = new Map<string, { count: number; day: string }>();
function allow(userId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(userId);
  if (!u || u.day !== day) { usage.set(userId, { count: 1, day }); return true; }
  u.count += 1;
  return u.count <= DAILY_LIMIT;
}

const MEDIA: ImageMediaType[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BASE64 = 2_000_000; // ~1.5 MB image; the client downsizes to 1024 px first

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  let body: { image?: unknown; mediaType?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 }); }
  const image = typeof body.image === "string" ? body.image.replace(/^data:[^;]+;base64,/, "") : "";
  const mediaType = MEDIA.includes(body.mediaType as ImageMediaType) ? (body.mediaType as ImageMediaType) : "image/jpeg";
  if (!image || image.length > MAX_BASE64) return NextResponse.json({ ok: false, error: "invalid_image" }, { status: 400 });
  if (!allow(user.id)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  try {
    const rec = await recognizeProduct(image, mediaType);
    if (!rec || (!rec.product && !rec.brand)) return NextResponse.json({ ok: false, error: "not_recognized" });
    const title = titleFromRecognition(rec);
    const candidates = rec.confidence === "low" ? [] : await searchWbMulti(queriesFromRecognition(rec));
    return NextResponse.json({ ok: true, title, price: rec.price_rub, confidence: rec.confidence, category: rec.category, candidates });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ ok: false, error: "upstream_busy" }, { status: 503 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ ok: false, error: "upstream_error" }, { status: 502 });
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
