import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ListScreen } from "@/components/ListScreen";
import type { Profile, WishItem, Wishlist } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // proxy redirects; defensive

  const [{ data: profile }, { data: lists }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("wishlists").select("*").eq("owner_id", user.id).order("created_at").limit(1),
  ]);
  let wishlist = (lists?.[0] as Wishlist | undefined) ?? null;
  if (!wishlist) {
    const { data } = await supabase.from("wishlists").insert({ owner_id: user.id }).select("*").single();
    wishlist = data as Wishlist;
  }
  const [{ data: items }, { data: share }] = await Promise.all([
    supabase.from("wish_items").select("*").eq("wishlist_id", wishlist.id).order("sort_order").order("created_at", { ascending: false }),
    supabase.from("share_links").select("token").eq("wishlist_id", wishlist.id).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const name = (profile as Profile | null)?.display_name || user.email?.split("@")[0] || "Вы";

  return (
    <div className="app">
      <ListScreen name={name} items={(items ?? []) as WishItem[]} shareToken={share?.token ?? null} />
      <BottomNav active="list" />
    </div>
  );
}
