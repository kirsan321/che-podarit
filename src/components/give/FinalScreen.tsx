"use client";

import Link from "next/link";
import type { FinalItem } from "@/lib/give/types";
import { sourceLabel } from "@/lib/give/format";
import { ItemThumb, itemPrice } from "./ItemThumb";
import { IconChevronRight } from "./GiveIcons";

interface Props {
  token: string;
  items: FinalItem[];
  source: "manual" | "slot";
  busyId: string | null;
  onConfirm: (reservationId: string) => void;
  onRelease: (reservationId: string) => void;
}

export function FinalScreen({ token, items, source, busyId, onConfirm, onRelease }: Props) {
  return (
    <>
      <div className="top"><h1>{items.length > 1 ? "Подарки выбраны" : "Подарок выбран"}</h1></div>
      <div className="sub">Для других дарителей он забронирован. Получатель об этом не узнает.</div>
      <div className="final">
        {items.map((g) => {
          const busy = busyId === g.reservation_id;
          return (
            <div key={g.reservation_id}>
              <div className="fitem">
                <ItemThumb item={g} className="th" />
                <div>
                  <div className="pr">{itemPrice(g)}</div>
                  <div className="nm">{g.title}</div>
                  {g.confirmed ? <small className="ok">Подарено</small> : <small>{source === "slot" ? "выбрала удача" : "выбрали сами"}</small>}
                </div>
              </div>
              {g.url && (
                <a className={"buy " + (g.source ?? "")} href={g.url} target="_blank" rel="noopener noreferrer">
                  Купить на {sourceLabel(g.source)} <IconChevronRight />
                </a>
              )}
              <div className="frow">
                {!g.confirmed && (
                  <button type="button" className="btn press" onClick={() => onConfirm(g.reservation_id)} disabled={busy}>Подарил</button>
                )}
                <button type="button" className="btn ghost press" onClick={() => onRelease(g.reservation_id)} disabled={busy}>Передумал, снять бронь</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="fnote">Нажмите «Подарил» после вручения: бронь останется навсегда. Иначе она снимется сама через две недели после даты события.</div>
      <div style={{ height: 12 }} />
      <Link href={`/s/${token}`} className="btn ghost press" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>К списку желаний</Link>
      <Link href="/give" className="hint" style={{ display: "block", textAlign: "center", paddingTop: 8, textDecoration: "none" }}>Все мои подарки</Link>
    </>
  );
}
