"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { GiveItem } from "@/lib/give/types";
import { ItemThumb, itemPrice } from "./ItemThumb";
import { IconHeartBold, IconUndo, IconX } from "./GiveIcons";

interface Props {
  queue: GiveItem[];
  likedCount: number;
  canUndo: boolean;
  onSwipe: (dir: 1 | -1) => void;
  onUndo: () => void;
  onDone: () => void;
}

const FLY_MS = 320;

/** Swipeable card stack: right = give, left = skip. Top three cards are rendered, only the top one is draggable. */
export function Deck({ queue, likedCount, canUndo, onSwipe, onUndo, onDone }: Props) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const busy = useRef(false);
  const drag = useRef({ on: false, sx: 0, sy: 0, dx: 0, t0: 0 });

  function stamps(card: HTMLDivElement) {
    return {
      yes: card.querySelector<HTMLElement>(".stamp.yes"),
      no: card.querySelector<HTMLElement>(".stamp.no"),
    };
  }

  function fly(dir: 1 | -1) {
    const card = topRef.current;
    if (!card || busy.current) return;
    busy.current = true;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.style.transition = reduced ? "none" : `transform ${FLY_MS}ms ease-out, opacity ${FLY_MS}ms`;
    card.style.transform = `translate(${dir * 520}px, -40px) rotate(${dir * 25}deg)`;
    card.style.opacity = "0";
    window.setTimeout(() => { busy.current = false; onSwipe(dir); }, reduced ? 0 : FLY_MS);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (busy.current) return;
    const card = e.currentTarget;
    drag.current = { on: true, sx: e.clientX, sy: e.clientY, dx: 0, t0: Date.now() };
    card.setPointerCapture(e.pointerId);
    card.style.transition = "none";
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d.on) return;
    const card = e.currentTarget;
    const W = card.offsetWidth || 1;
    d.dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    card.style.transform = `translate(${d.dx}px, ${dy * 0.3}px) rotate(${(d.dx / W) * 15}deg)`;
    const p = Math.min(1, Math.abs(d.dx) / (W * 0.3));
    const { yes, no } = stamps(card);
    if (yes) yes.style.opacity = d.dx > 0 ? String(p) : "0";
    if (no) no.style.opacity = d.dx < 0 ? String(p) : "0";
  }
  function onPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    const card = e.currentTarget;
    const W = card.offsetWidth || 1;
    const v = Math.abs(d.dx) / (Date.now() - d.t0 + 1);
    if (Math.abs(d.dx) > W * 0.3 || v > 0.6) {
      fly(d.dx > 0 ? 1 : -1);
    } else {
      card.style.transition = "transform .3s";
      card.style.transform = "";
      const { yes, no } = stamps(card);
      if (yes) yes.style.opacity = "0";
      if (no) no.style.opacity = "0";
    }
    d.dx = 0;
  }

  const visible = queue.slice(0, 3);

  return (
    <>
      <div className="stage">
        {visible.length === 0 ? (
          <div className="empty">
            <div>Карточки кончились.<br />Вы готовы подарить: <b style={{ display: "inline", color: "var(--ink)" }}>{likedCount}</b></div>
          </div>
        ) : (
          visible.slice().reverse().map((item, i, arr) => {
            const depth = arr.length - 1 - i;
            const top = depth === 0;
            return (
              <div
                key={item.id}
                ref={top ? topRef : undefined}
                className="gcard"
                style={{ transform: `translateY(${depth * -10}px) scale(${1 - depth * 0.05})`, zIndex: 3 - depth }}
                onPointerDown={top ? onPointerDown : undefined}
                onPointerMove={top ? onPointerMove : undefined}
                onPointerUp={top ? onPointerEnd : undefined}
                onPointerCancel={top ? onPointerEnd : undefined}
              >
                <ItemThumb item={item} className="ph" />
                {item.priority === "want" && <span className="badge want" style={{ position: "absolute", left: 12, top: 12 }}>очень хочу</span>}
                <div className="body">
                  <div className="price">{itemPrice(item)} {item.source && <span className={"src " + item.source}>{item.source.toUpperCase()}</span>}</div>
                  <div className="nm">{item.title}</div>
                  {item.comment && <div className="cm">{item.comment}</div>}
                  <div className="why">
                    {item.kind === "exact" ? <span>именно это</span> : <span className="dir">направление</span>}
                    {item.tags.map((t) => <span key={t} className="dir">{t}</span>)}
                    {item.anti_tags.map((t) => <span key={"n" + t} className="no">{t}</span>)}
                  </div>
                </div>
                <div className="stamp yes">ДАРЮ</div>
                <div className="stamp no">МИМО</div>
              </div>
            );
          })
        )}
      </div>
      <div className="actions">
        <button type="button" className="rb undo" onClick={onUndo} disabled={!canUndo} aria-label="Отменить"><IconUndo /></button>
        <button type="button" className="rb no" onClick={() => fly(-1)} disabled={!visible.length} aria-label="Нет"><IconX /></button>
        <button type="button" className="rb yes" onClick={() => fly(1)} disabled={!visible.length} aria-label="Готов подарить"><IconHeartBold /></button>
      </div>
      <div className="done"><button type="button" className="btn ghost press" onClick={onDone}>Хватит, выбираю</button></div>
    </>
  );
}
