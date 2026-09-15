import type { ItemKind, ItemPriority } from "../types";

/** One row of the public_wishlist RPC (what an anonymous giver may see). */
export interface PublicItem {
  wishlist_id: string;
  owner_name: string | null;
  item_id: string;
  kind: ItemKind;
  title: string;
  url: string | null;
  image_url: string | null;
  source: string | null;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  priority: ItemPriority;
  comment: string | null;
  tags: string[];
  anti_tags: string[];
  occasion_tags: string[];
  reserved: boolean;
}

/** Item as carried through the giver flow (deck, shortlist, final). */
export interface GiveItem {
  id: string;
  kind: ItemKind;
  title: string;
  url: string | null;
  image_url: string | null;
  source: string | null;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  priority: ItemPriority;
  comment: string | null;
  tags: string[];
  anti_tags: string[];
}

export interface GiverEvent {
  event_id: string;
  token: string;
  link_revoked: boolean;
  recipient_name: string | null;
  occasion: string | null;
  event_date: string | null;
  budget: number | null;
  created_at: string;
  reserved_count: number;
  reserved_items: ReservedItem[];
}

export interface ReservedItem {
  reservation_id: string;
  item_id: string;
  kind: ItemKind;
  title: string;
  url: string | null;
  image_url: string | null;
  source: string | null;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  confirmed: boolean;
}

/** A chosen item on the final screen, with its reservation. */
export interface FinalItem extends GiveItem {
  reservation_id: string;
  confirmed: boolean;
}

export const OCCASIONS = ["День рождения", "Новый год", "Свадьба", "Просто так", "Другое"] as const;
export const BUDGETS: { value: number | null; label: string }[] = [
  { value: 1500, label: "до 1 500 ₽" },
  { value: 5000, label: "до 5 000 ₽" },
  { value: 15000, label: "до 15 000 ₽" },
  { value: null, label: "не важно" },
];

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** PostgREST may serialize numeric columns as strings; normalize once at the boundary. */
export function normalizePublicItem(r: PublicItem): PublicItem {
  return { ...r, price: num(r.price), price_min: num(r.price_min), price_max: num(r.price_max), tags: r.tags ?? [], anti_tags: r.anti_tags ?? [], occasion_tags: r.occasion_tags ?? [] };
}

export function toGiveItem(r: PublicItem): GiveItem {
  return {
    id: r.item_id, kind: r.kind, title: r.title, url: r.url, image_url: r.image_url, source: r.source,
    price: r.price, price_min: r.price_min, price_max: r.price_max, priority: r.priority, comment: r.comment,
    tags: r.tags, anti_tags: r.anti_tags,
  };
}

export function reservedToFinal(r: ReservedItem): FinalItem {
  return {
    id: r.item_id, kind: r.kind, title: r.title, url: r.url, image_url: r.image_url, source: r.source,
    price: num(r.price), price_min: num(r.price_min), price_max: num(r.price_max), priority: "nice", comment: null,
    tags: [], anti_tags: [], reservation_id: r.reservation_id, confirmed: r.confirmed,
  };
}

export function normalizeGiverEvent(e: GiverEvent): GiverEvent {
  return { ...e, budget: num(e.budget), reserved_items: (e.reserved_items ?? []) as ReservedItem[] };
}
