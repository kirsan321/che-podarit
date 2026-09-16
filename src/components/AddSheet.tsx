"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addItem, type ItemState } from "@/app/list/actions";
import type { ParsedProduct } from "@/lib/parse/types";
import type { WbCandidate } from "@/lib/parse/wbSearch";

const isHttpUrl = (s: string) => /^https?:\/\/\S+\.\S+/i.test(s.trim());

type ParseStatus = "idle" | "loading" | "ok" | "fail" | "candidates" | "partial";
const PHOTO_HINTS: Record<string, string> = {
  candidates: "Распознали по фото. Это оно? Возьмём фото и цену с Wildberries",
  partial: "Распознали по фото, проверьте название и добавьте цену",
  fail: "Не удалось распознать фото, заполните вручную",
};

export interface AddSheetPrefill { url?: string; title?: string; price?: number | null; candidates?: WbCandidate[]; hint?: "photo" | "photo-fail" }

export function AddSheet({ initialUrl, initialTitle, prefill, onClose, onAdded }: { initialUrl?: string; initialTitle?: string; prefill?: AddSheetPrefill; onClose: () => void; onAdded: () => void }) {
  const looksLikeUrl = !!initialUrl && isHttpUrl(initialUrl);
  const [kind, setKind] = useState<"exact" | "direction">("exact");
  const [state, action, pending] = useActionState<ItemState, FormData>(addItem, undefined);

  const [url, setUrl] = useState(looksLikeUrl ? initialUrl!.trim() : "");
  const [title, setTitle] = useState(initialTitle ?? (looksLikeUrl ? "" : initialUrl ?? ""));
  const [price, setPrice] = useState(prefill?.price != null ? String(Math.round(prefill.price)) : "");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<ParseStatus>(prefill?.hint === "photo" ? (prefill.candidates?.length ? "candidates" : "partial") : prefill?.hint === "photo-fail" ? "fail" : "idle");
  const [candidates, setCandidates] = useState<WbCandidate[]>(prefill?.candidates ?? []);
  const [pickedId, setPickedId] = useState<number | null>(null);
  // Last values we filled in automatically; only these get overwritten by a new parse.
  const auto = useRef<{ title: string; price: string }>({ title: "", price: "" });
  const reqId = useRef(0);
  const titleRef = useRef(initialTitle ?? "");
  const lastParsed = useRef<string>("");

  useEffect(() => { if (state?.ok) onAdded(); }, [state, onAdded]);

  function onUrlChange(v: string) {
    setUrl(v);
    if (!isHttpUrl(v)) { setStatus("idle"); setImageUrl(""); setCandidates([]); setPickedId(null); lastParsed.current = ""; }
  }

  useEffect(() => {
    const candidate = url.trim();
    if (kind !== "exact" || !isHttpUrl(candidate) || candidate === lastParsed.current) return;
    const id = ++reqId.current;
    const ac = new AbortController();
    // Instant for a URL the sheet opened with, debounced while the user types.
    const delay = id === 1 && looksLikeUrl ? 0 : 500;
    const timer = setTimeout(async () => {
      lastParsed.current = candidate;
      setStatus("loading");
      let product: ParsedProduct | null = null;
      let found: WbCandidate[] = [];
      try {
        const res = await fetch("/api/parse-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: candidate, title: titleRef.current }),
          signal: ac.signal,
        });
        const json = (await res.json()) as { ok: boolean; product?: ParsedProduct | null; candidates?: WbCandidate[] };
        if (json.ok && json.product) product = json.product;
        found = json.candidates ?? [];
      } catch {
        product = null;
      }
      if (ac.signal.aborted || id !== reqId.current) return;
      setCandidates(found);
      setPickedId(null);
      if (!product) { setStatus(found.length ? "candidates" : "fail"); setImageUrl(""); return; }
      setTitle((cur) => (cur.trim() === "" || cur === auto.current.title ? product!.title : cur));
      auto.current.title = product.title;
      const p = product.price != null ? String(Math.round(product.price)) : "";
      if (p) {
        setPrice((cur) => (cur.trim() === "" || cur === auto.current.price ? p : cur));
        auto.current.price = p;
      }
      setImageUrl(product.image ?? "");
      setStatus(product.confidence === "low" || product.price == null ? (found.length ? "candidates" : "partial") : "ok");
    }, delay);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [url, kind, looksLikeUrl]);

  function pick(c: WbCandidate) {
    setPickedId(c.id);
    setImageUrl(c.image ?? "");
    if (c.price != null) {
      const p = String(Math.round(c.price));
      setPrice((cur) => (cur.trim() === "" || cur === auto.current.price ? p : cur));
      auto.current.price = p;
    }
    if (title.trim() === "") { setTitle(c.title); titleRef.current = c.title; auto.current.title = c.title; }
    setStatus("ok");
  }

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
          {kind === "exact" && imageUrl && (
            <div className="parse-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" onError={() => setImageUrl("")} />
            </div>
          )}
          {prefill?.hint && status !== "loading" && status !== "ok" && PHOTO_HINTS[status] && <div className="parse-hint" style={{ margin: "0 16px 10px" }}>{PHOTO_HINTS[status]}</div>}
          <div className="field">
            <label htmlFor="title">{kind === "exact" ? "Что именно" : "Какое направление"}</label>
            <input id="title" name="title" required autoFocus value={title} onChange={(e) => { setTitle(e.target.value); titleRef.current = e.target.value; }} placeholder={kind === "exact" ? "Kindle Paperwhite 16 ГБ, чёрный" : "Что-то для домашнего кофе"} />
          </div>
          {kind === "exact" ? (
            <>
              <div className="field">
                <label htmlFor="url">Ссылка на товар</label>
                <input id="url" name="url" type="url" inputMode="url" value={url} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://www.wildberries.ru/catalog/..." />
                {status === "loading" && <div className="parse-hint loading"><span className="parse-dot" />Ищу товар…</div>}
                {status === "ok" && <div className="parse-hint ok">Нашли товар, проверьте название и цену</div>}
                {status === "fail" && <div className="parse-hint">Не удалось прочитать страницу, заполните вручную</div>}
                {status === "candidates" && <div className="parse-hint">Магазин не отдаёт страницу, но нашли похожее на Wildberries</div>}
                {status === "partial" && <div className="parse-hint">Название взяли из ссылки, цену и фото добавьте сами</div>}
              </div>
              {candidates.length > 0 && (
                <div className="field">
                  <label>Это оно? Возьмём фото и цену</label>
                  <div className="cands">
                    {candidates.map((c) => (
                      <button type="button" key={c.id} className={"cand press" + (pickedId === c.id ? " on" : "")} onClick={() => pick(c)}>
                        <div className="cand-img">{c.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.image} alt="" /> : null}</div>
                        <div className="cand-p">{c.price != null ? `${Math.round(c.price).toLocaleString("ru-RU")} \u20BD` : "цена не указана"}</div>
                        <div className="cand-n">{c.title}</div>
                      </button>
                    ))}
                  </div>
                  <div className="parse-hint">Не то? Просто заполните цену сами, ссылка останется вашей</div>
                </div>
              )}
              <div className="field">
                <label htmlFor="price">Цена, примерно</label>
                <input id="price" name="price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4 990" />
              </div>
              <input type="hidden" name="image_url" value={imageUrl} />
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
