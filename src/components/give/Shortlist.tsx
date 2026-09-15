"use client";

import type { GiveItem } from "@/lib/give/types";
import { ItemThumb, itemPrice } from "./ItemThumb";
import { IconCheck, IconDice, IconX } from "./GiveIcons";

interface Props {
  liked: GiveItem[];
  picked: Set<string>;
  slotUsed: boolean;
  busy: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onSlot: () => void;
  onPick: () => void;
}

export function Shortlist({ liked, picked, slotUsed, busy, onToggle, onRemove, onSlot, onPick }: Props) {
  const n = liked.length;
  const luckHint = slotUsed ? "Попытка уже использована" : n < 2 ? "Для рулетки нужно хотя бы 2 подарка" : `Одна попытка · крутим среди ${n}`;
  return (
    <>
      <div className="sub">{n ? "Уберите то, с чем не согласны. Тап — выбрать самому." : "Пусто. Вернитесь к карточкам."}</div>
      <div className="sgrid">
        {liked.map((g) => {
          const on = picked.has(g.id);
          return (
            <div key={g.id} className={"sc press" + (on ? " pick" : "")}>
              <button type="button" className="tap" onClick={() => onToggle(g.id)} aria-pressed={on}>
                <ItemThumb item={g} className="img" />
                <div className="p">{itemPrice(g)}</div>
                <div className="n">{g.title}</div>
              </button>
              <span className="chk" aria-hidden><IconCheck /></span>
              <button type="button" className="x" onClick={() => onRemove(g.id)} aria-label="Убрать"><IconX size={16} /></button>
            </div>
          );
        })}
      </div>
      <div className="bar">
        <button type="button" className="btn press" onClick={onSlot} disabled={n < 2 || slotUsed || busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <IconDice /> Довериться удаче
        </button>
        <div className="hint">{luckHint}</div>
        <button type="button" className="btn ghost press" onClick={onPick} disabled={!picked.size || busy}>
          {busy ? "Бронируем..." : picked.size ? `Выбрать отмеченные (${picked.size})` : "Выбрать самому — отметьте подарок"}
        </button>
      </div>
    </>
  );
}
