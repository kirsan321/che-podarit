export type ItemKind = "exact" | "direction";
export type ItemPriority = "want" | "nice";
export type ItemStatus = "active" | "received";

export interface WishItem {
  id: string;
  wishlist_id: string;
  kind: ItemKind;
  title: string;
  url: string | null;
  image_url: string | null;
  source: string | null;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  priority: ItemPriority;
  comment: string | null;
  tags: string[];
  anti_tags: string[];
  occasion_tags: string[];
  visible: boolean;
  status: ItemStatus;
  sort_order: number;
  created_at: string;
  received_at: string | null;
}

export interface Wishlist {
  id: string;
  owner_id: string;
  title: string;
  show_reservations: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "";
  return Math.round(n).toLocaleString("ru-RU") + " ₽";
}

export function sourceFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h.endsWith("wildberries.ru") || h === "wb.ru") return "wb";
    if (h.endsWith("ozon.ru")) return "ozon";
    if (h.endsWith("market.yandex.ru")) return "ym";
    if (h.endsWith("lamoda.ru")) return "lamoda";
    return h.split(".").slice(-2, -1)[0] ?? null;
  } catch {
    return null;
  }
}
