"use client";

import { useActionState, useEffect, useState } from "react";
import { addItem, type ItemState } from "@/app/list/actions";

export function AddSheet({ initialUrl, onClose, onAdded }: { initialUrl?: string; onClose: () => void; onAdded: () => void }) {
  const looksLikeUrl = !!initialUrl && /^https?:\/\//i.test(initialUrl);
  const [kind, setKind] = useState<"exact" | "direction">("exact");
  const [state, action, pending] = useActionState<ItemState, FormData>(addItem, undefined);

  useEffect(() => { if (state?.ok) onAdded(); }, [state, onAdded]);

  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <h2>Новое желание</h2>
        <form action={action}>
          <div className="seg">
            <button type="button" className={kind === "exact" ? "on" : ""} onClick={() => setKind("exact")}>Именно это</button>
            <button type="button" className={kind === "direction" ? "on" : ""} onClick={() => setKind("direction")}>Можно похожее</button>
          </div>
          <input type="hidden" name="kind" value={kind} />
          <div className="field">
            <label htmlFor="title">{kind === "exact" ? "Что именно" : "Какое направление"}</label>
            <input id="title" name="title" required autoFocus defaultValue={looksLikeUrl ? "" : initialUrl ?? ""} placeholder={kind === "exact" ? "Kindle Paperwhite 16 ГБ, чёрный" : "Что-то для домашнего кофе"} />
          </div>
          {kind === "exact" ? (
            <>
              <div className="field">
                <label htmlFor="url">Ссылка на товар</label>
                <input id="url" name="url" type="url" inputMode="url" defaultValue={looksLikeUrl ? initialUrl : ""} placeholder="https://www.wildberries.ru/catalog/..." />
              </div>
              <div className="field">
                <label htmlFor="price">Цена, примерно</label>
                <input id="price" name="price" inputMode="numeric" placeholder="4 990" />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label>Бюджет от и до</label>
                <div className="two">
                  <input name="price_min" inputMode="numeric" placeholder="от 3 000" aria-label="от" />
                  <input name="price_max" inputMode="numeric" placeholder="до 6 000" aria-label="до" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="tags">Подсказки, через запятую</label>
                <input id="tags" name="tags" placeholder="кофе дома, зёрна с кислинкой" />
              </div>
              <div className="field">
                <label htmlFor="anti_tags">Чего не надо, через запятую</label>
                <input id="anti_tags" name="anti_tags" placeholder="турка уже есть" />
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="comment">Комментарий дарителю</label>
            <input id="comment" name="comment" placeholder="размер M, любой цвет кроме красного" />
          </div>
          <div className="field">
            <label>Насколько хочется</label>
            <div className="seg" style={{ margin: 0 }}>
              <PriorityToggle />
            </div>
          </div>
          {state?.error && <div className="err">{state.error}</div>}
          <button className="btn press" type="submit" disabled={pending}>{pending ? "Сохраняю…" : "Добавить в список"}</button>
          <button className="btn ghost press" type="button" onClick={onClose}>Отмена</button>
        </form>
      </div>
    </>
  );
}

function PriorityToggle() {
  const [p, setP] = useState<"nice" | "want">("nice");
  return (
    <>
      <button type="button" className={p === "nice" ? "on" : ""} onClick={() => setP("nice")}>Было бы приятно</button>
      <button type="button" className={p === "want" ? "on" : ""} onClick={() => setP("want")}>Очень хочу</button>
      <input type="hidden" name="priority" value={p} />
    </>
  );
}
