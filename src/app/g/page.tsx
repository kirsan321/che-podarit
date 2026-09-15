import type { Metadata } from "next";
import Link from "next/link";
import "@/app/give.css";
import { GiverEvents } from "@/components/give/GiverEvents";
import { loadGiverEvents } from "@/lib/give/data";
import { getGiverKey } from "@/lib/give/key";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Дарю", robots: { index: false, follow: false } };

/** Anonymous "Daryu" tab: the giver_key cookie is the only identity. */
export default async function AnonymousGivePage() {
  const events = await loadGiverEvents(await getGiverKey());
  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <div className="top"><h1>Дарю</h1></div>
      <div className="sub">Кому и по какому поводу вы дарите. Брони держатся до вручения.</div>
      <GiverEvents events={events} />
      <div className="pub-foot"><Link href="/login">чЁ подарить</Link> · свой список за минуту</div>
    </div>
  );
}
