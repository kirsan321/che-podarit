import Link from "next/link";
import type { GiverEvent } from "@/lib/give/types";
import { budgetText, countdownText, daysBetween, fmtDate, plural, todayIso } from "@/lib/give/format";

/** Rows for the "Daryu" tab: one per giver event. Server-safe. */
export function GiverEvents({ events }: { events: GiverEvent[] }) {
  if (!events.length) {
    return (
      <div className="empty">
        <b>Пока никому не дарите</b>
        Откройте ссылку на список желаний, которую вам прислали, и нажмите «Выбрать подарок».
      </div>
    );
  }
  const today = todayIso();
  return (
    <div>
      {events.map((e) => {
        const name = e.recipient_name || "Список";
        const when = e.event_date ? `${fmtDate(e.event_date)}, ${countdownText(daysBetween(today, e.event_date))}` : null;
        const sub = [e.occasion, when, budgetText(e.budget)].filter(Boolean).join(" · ");
        const n = e.reserved_count;
        const titles = e.reserved_items.map((r) => r.title).join(", ");
        return (
          <Link key={e.event_id} href={`/s/${e.token}/give/deck?e=${e.event_id}`} className="person press">
            <div className="ava">{name.trim()[0]?.toUpperCase() ?? "?"}</div>
            <div className="pt">
              <b>{name}</b>
              <small>{sub}</small>
              {titles && <small style={{ color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titles}</small>}
            </div>
            <span className={"st " + (n ? "has" : "ask")}>{n ? `${n} ${plural(n, "подарок", "подарка", "подарков")}` : e.link_revoked ? "ссылка отозвана" : "выбрать"}</span>
          </Link>
        );
      })}
    </div>
  );
}
