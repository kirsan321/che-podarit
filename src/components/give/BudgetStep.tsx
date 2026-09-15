"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { startGiverEvent } from "@/lib/give/actions";
import { deckItems, type BudgetItem } from "@/lib/give/filter";
import { plural } from "@/lib/give/format";
import { BUDGETS, OCCASIONS } from "@/lib/give/types";
import { IconBack } from "./GiveIcons";

interface Props {
  token: string;
  owner: string;
  items: BudgetItem[];
  exactCount: number;
  directionCount: number;
}

export function BudgetStep({ token, owner, items, exactCount, directionCount }: Props) {
  const router = useRouter();
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0]);
  const [other, setOther] = useState("");
  const [date, setDate] = useState("");
  const [budget, setBudget] = useState<number | null>(5000);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fit = useMemo(() => deckItems(items, budget).length, [items, budget]);
  const total = items.filter((i) => !i.reserved).length;
  const initial = owner.trim()[0]?.toUpperCase() ?? "?";

  function start() {
    setError(null);
    const occ = occasion === "Другое" ? other.trim() || "Другое" : occasion;
    startTransition(async () => {
      const res = await startGiverEvent(token, { occasion: occ, eventDate: date || null, budget });
      if ("error" in res) {
        setError(res.error === "invalid_token" ? "Ссылка больше не работает" : "Не получилось начать. Попробуйте ещё раз");
        return;
      }
      router.push(`/s/${token}/give/deck?e=${res.eventId}`);
    });
  }

  return (
    <>
      <div className="top">
        <Link href={`/s/${token}`} className="back" aria-label="Назад"><IconBack /></Link>
        <h1>{owner}: выбираем подарок</h1>
      </div>
      <div className="card-p">
        <div className="ava">{initial}</div>
        <div>
          <b>{total} {plural(total, "желание", "желания", "желаний")} в списке</b>
          <small>{describeKinds(exactCount, directionCount)}</small>
        </div>
      </div>

      <div className="lbl">Повод</div>
      <div className="gchips" role="radiogroup" aria-label="Повод">
        {OCCASIONS.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={occasion === o} className={"chip" + (occasion === o ? " on" : "")} onClick={() => setOccasion(o)}>{o}</button>
        ))}
      </div>
      {occasion === "Другое" && (
        <div className="gother"><input value={other} onChange={(e) => setOther(e.target.value)} maxLength={60} placeholder="Какой повод" aria-label="Какой повод" /></div>
      )}

      <div className="lbl">Когда дарить <span style={{ color: "var(--muted)", fontWeight: 400 }}>· необязательно</span></div>
      <div className="gdate">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Дата события" />
        {date && <button type="button" className="clr" onClick={() => setDate("")}>Сбросить</button>}
      </div>

      <div className="lbl">Сколько готовы потратить</div>
      <div className="gchips" role="radiogroup" aria-label="Бюджет">
        {BUDGETS.map((b) => (
          <button key={b.label} type="button" role="radio" aria-checked={budget === b.value} className={"chip" + (budget === b.value ? " on" : "")} onClick={() => setBudget(b.value)}>{b.label}</button>
        ))}
      </div>

      <button type="button" className="btn press" onClick={start} disabled={pending || fit === 0}>
        {pending ? "Секунду..." : "Смотреть подарки"}
      </button>
      {error && <div className="err">{error}</div>}
      <div className="fit">Подходящих под бюджет: <b>{fit}</b>{fit === 0 && total > 0 ? " · попробуйте бюджет побольше" : ""}</div>
      <div className="hint" style={{ paddingTop: 6 }}>Свайп вправо — готов подарить, влево — нет.</div>
    </>
  );
}

function describeKinds(exact: number, dirs: number): string {
  const parts: string[] = [];
  if (exact) parts.push(`${exact} ${plural(exact, "точная вещь", "точные вещи", "точных вещей")}`);
  if (dirs) parts.push(`${dirs} ${plural(dirs, "направление", "направления", "направлений")}`);
  return parts.join(" и ") || "пока пусто";
}
