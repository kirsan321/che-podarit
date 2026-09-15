import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import "@/app/give.css";
import { GiveFlow } from "@/components/give/GiveFlow";
import { loadGiverEvents, loadPublicList } from "@/lib/give/data";
import { deckItems } from "@/lib/give/filter";
import { getGiverKey } from "@/lib/give/key";
import { reservedToFinal, toGiveItem } from "@/lib/give/types";
import { InvalidLink } from "../page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Подарки", robots: { index: false, follow: false } };

export default async function GiveDeckPage({ params, searchParams }: PageProps<"/s/[token]/give/deck">) {
  const { token } = await params;
  const { e } = await searchParams;
  const eventId = typeof e === "string" ? e : "";
  const giverKey = await getGiverKey();
  const events = giverKey && eventId ? await loadGiverEvents(giverKey) : [];
  const event = events.find((x) => x.event_id === eventId && x.token === token);
  if (!event) redirect(`/s/${token}/give`);

  const { valid, rows } = await loadPublicList(token);
  if (!valid) return <InvalidLink />;
  const owner = rows[0]?.owner_name ?? event.recipient_name ?? "Список";
  const items = deckItems(rows, event.budget).map(toGiveItem);
  const existing = event.reserved_items.map(reservedToFinal);

  return (
    <GiveFlow token={token} eventId={event.event_id} owner={owner} occasion={event.occasion} budget={event.budget} items={items} existing={existing} snapshot={randomUUID()} />
  );
}
