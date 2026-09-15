"use client";

import { useEffect, useRef, useState } from "react";
import type { GiveItem } from "@/lib/give/types";
import { ItemThumb, itemPrice } from "./ItemThumb";

interface Props {
  items: GiveItem[];
  winner: GiveItem;
  busy: boolean;
  onTake: () => void;
  onManual: () => void;
}

const ROW_H = 110, REEL_H = 250, LOOPS = 4, SPIN_MS = 3200;

/** Vertical reel: the pool repeated LOOPS times, then the winner, which lands inside the highlight window. */
export function SlotMachine({ items, winner, busy, onTake, onManual }: Props) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [done, setDone] = useState(false);
  const strip: GiveItem[] = [];
  for (let i = 0; i < LOOPS; i++) strip.push(...items);
  strip.push(winner);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const offset = (strip.length - 1) * ROW_H - (REEL_H / 2 - ROW_H / 2);
    el.style.transition = "none";
    el.style.transform = "translateY(0)";
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.style.transition = reduced ? "none" : `transform ${SPIN_MS}ms cubic-bezier(.12,.8,.2,1)`;
        el.style.transform = `translateY(-${offset}px)`;
      });
    });
    const t = window.setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate([20, 40, 60]);
      setDone(true);
    }, reduced ? 100 : SPIN_MS + 100);
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(t); };
    // The reel runs once per mount; the parent remounts it per attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="top"><h1>{done ? "Удача выбрала" : "Судьба выбирает..."}</h1></div>
      <div className="slot-wrap">
        <div className="reel">
          <div className="win" />
          <div className="strip" ref={stripRef}>
            {strip.map((g, i) => (
              <div key={g.id + i} className="ri">
                <ItemThumb item={g} className="e" />
                <div><b>{g.title}</b><small>{itemPrice(g)}</small></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {done && (
        <div className="result">
          <ItemThumb item={winner} className="big" />
          <h2>{winner.title}</h2>
          <div className="pr">{itemPrice(winner)}</div>
          <p>Попытка была одна — но выбрать самому всё ещё можно</p>
          <button type="button" className="btn press" onClick={onTake} disabled={busy}>{busy ? "Бронируем..." : "Беру!"}</button>
          <button type="button" className="btn ghost press" onClick={onManual} disabled={busy}>Выбрать самому</button>
        </div>
      )}
    </>
  );
}
