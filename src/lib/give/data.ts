import { createClient } from "@/lib/supabase/server";
import { normalizeGiverEvent, normalizePublicItem, type GiverEvent, type PublicItem } from "@/lib/give/types";

/** Public list for a share token. `valid` is false for revoked/unknown tokens. */
export async function loadPublicList(token: string): Promise<{ valid: boolean; rows: PublicItem[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_wishlist", { p_token: token });
  const rows = ((data ?? []) as PublicItem[]).map(normalizePublicItem);
  if (error) return { valid: false, rows: [] };
  if (rows.length > 0) return { valid: true, rows };
  const { data: ok } = await supabase.rpc("share_link_valid", { p_token: token });
  return { valid: ok === true, rows };
}

export async function loadGiverEvents(giverKey: string | null): Promise<GiverEvent[]> {
  if (!giverKey) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_giver_events", { p_giver_key: giverKey });
  return ((data ?? []) as GiverEvent[]).map(normalizeGiverEvent);
}
