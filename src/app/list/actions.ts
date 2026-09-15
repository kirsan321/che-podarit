"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sourceFromUrl } from "@/lib/types";

async function ownedWishlistId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  const { data } = await supabase.from("wishlists").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await supabase.from("wishlists").insert({ owner_id: user.id }).select("id").single();
  if (error) throw error;
  return created.id;
}

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function list(v: FormDataEntryValue | null): string[] {
  return String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12);
}

export type ItemState = { error?: string; ok?: boolean } | undefined;

export async function addItem(_prev: ItemState, formData: FormData): Promise<ItemState> {
  const kind = formData.get("kind") === "direction" ? "direction" : "exact";
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Напишите, что хочется" };
  const url = String(formData.get("url") ?? "").trim() || null;
  const supabase = await createClient();
  const wishlist_id = await ownedWishlistId();
  const row = {
    wishlist_id,
    kind,
    title: title.slice(0, 200),
    url,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    source: sourceFromUrl(url),
    price: kind === "exact" ? num(formData.get("price")) : null,
    price_min: kind === "direction" ? num(formData.get("price_min")) : null,
    price_max: kind === "direction" ? num(formData.get("price_max")) : null,
    priority: formData.get("priority") === "want" ? "want" : "nice",
    comment: String(formData.get("comment") ?? "").trim().slice(0, 500) || null,
    tags: kind === "direction" ? list(formData.get("tags")) : [],
    anti_tags: kind === "direction" ? list(formData.get("anti_tags")) : [],
  };
  const { error } = await supabase.from("wish_items").insert(row);
  if (error) return { error: "Не сохранилось. Попробуйте ещё раз" };
  revalidatePath("/list");
  return { ok: true };
}

export async function setVisible(id: string, visible: boolean) {
  const supabase = await createClient();
  await supabase.from("wish_items").update({ visible }).eq("id", id);
  revalidatePath("/list");
}

export async function deleteItem(id: string) {
  const supabase = await createClient();
  await supabase.from("wish_items").delete().eq("id", id);
  revalidatePath("/list");
}

export async function setReceived(id: string, received: boolean) {
  const supabase = await createClient();
  await supabase.from("wish_items").update({
    status: received ? "received" : "active",
    received_at: received ? new Date().toISOString() : null,
  }).eq("id", id);
  revalidatePath("/list");
}
