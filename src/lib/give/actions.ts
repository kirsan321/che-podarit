"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureGiverKey } from "@/lib/give/key";
import { OCCASIONS } from "@/lib/give/types";

export type StartResult = { eventId: string } | { error: string };

function rpcError(e: { message?: string } | null): string {
  const m = e?.message ?? "";
  for (const code of ["already_reserved", "invalid_token", "invalid_event", "invalid_item"]) {
    if (m.includes(code)) return code;
  }
  return "failed";
}

export async function startGiverEvent(
  token: string,
  input: { occasion: string | null; eventDate: string | null; budget: number | null },
): Promise<StartResult> {
  const giverKey = await ensureGiverKey();
  const supabase = await createClient();
  const occasion = input.occasion ? input.occasion.trim().slice(0, 60) || null : null;
  const eventDate = input.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) ? input.eventDate : null;
  const budget = input.budget != null && Number.isFinite(input.budget) && input.budget > 0 ? Math.round(input.budget) : null;
  if (occasion && occasion.length > 60) return { error: "failed" };
  void OCCASIONS;
  const { data, error } = await supabase.rpc("create_giver_event", {
    p_token: token, p_giver_key: giverKey, p_occasion: occasion, p_event_date: eventDate, p_budget: budget,
  });
  if (error || !data) return { error: rpcError(error) };
  return { eventId: data as string };
}

export type ReserveOutcome = { itemId: string; reservationId: string } | { itemId: string; error: string };

/** Reserve several items for an event; each item succeeds or fails independently. */
export async function reserveItems(token: string, eventId: string, itemIds: string[]): Promise<ReserveOutcome[]> {
  const giverKey = await ensureGiverKey();
  const supabase = await createClient();
  const out: ReserveOutcome[] = [];
  for (const itemId of itemIds.slice(0, 20)) {
    const { data, error } = await supabase.rpc("reserve_item", {
      p_token: token, p_giver_key: giverKey, p_event_id: eventId, p_item_id: itemId,
    });
    if (error || !data) out.push({ itemId, error: rpcError(error) });
    else out.push({ itemId, reservationId: data as string });
  }
  return out;
}

export async function confirmReservation(token: string, reservationId: string): Promise<{ ok: boolean }> {
  const giverKey = await ensureGiverKey();
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_reservation", { p_token: token, p_giver_key: giverKey, p_reservation_id: reservationId });
  return { ok: !error };
}

export async function releaseReservation(token: string, reservationId: string): Promise<{ ok: boolean }> {
  const giverKey = await ensureGiverKey();
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_reservation", { p_token: token, p_giver_key: giverKey, p_reservation_id: reservationId });
  return { ok: !error };
}
