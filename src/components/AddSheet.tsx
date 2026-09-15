"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addItem, type ItemState } from "@/app/list/actions";
import type { ParsedProduct } from "@/lib/parse/types";

const isHttpUrl = (s: string) => /^https?:\/\/\S+\.\S+/i.test(s.trim());

type ParseStatus = "idle" | "loading" | "ok" | "fail";

export function AddSheet({ initialUrl, onClose, onAdded }: { initialUrl?: string; onClose: () => void; onAdded: () => void }) {
  const looksLikeUrl = !!initialUrl && isHttpUrl(initialUrl);
  const [kind, setKind] = useState<"exact" | "direction">("exact");
  const [state, action, pending] = useActionState<ItemState, FormData>(addItem, undefined);

  const [url, setUrl] = useState(looksLikeUrl ? initialUrl!.trim() : "");
  const [title, setTitle] = useState(looksLikeUrl ? "" : initialUrl ?? "");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<ParseStatus>("idle");
  // Last values we filled in automatically; only these get overwritten by a new parse.
  const auto = useRef<{ title: string; price: string }>({ title: "", price: "" });
  const reqId = useRef(0);
  const lastParsed = useRef<string>("");

  useEffect(() => { if (state?.ok) onAdded(); }, [state, onAdded]);

  function onUrlChange(v: string) {
    setUrl(v);
    if (!isHttpUrl(v)) { setStatus("idle"); setImageUrl(""); lastParsed.current = ""; }
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
      try {
        const res = await fetch("/api/parse-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: candidate }),
          signal: ac.signal,
        });
        const json = (await res.json()) as { ok: boolean; product?: ParsedProduct };
        if (json.ok && json.product) product = json.product;
      } catch {
        product = null;
      }
      if (ac.signal.aborted || id !== reqId.current) return;
      if (!product) { setStatus("fail"); setImageUrl(""); return; }
      setTitle((cur) => (cur.trim() === "" || cur === auto.current.title ? product!.title : cur));
      auto.current.title = product.title;
      const p = product.price != null ? String(Math.round(product.price)) : "";
      if (p) {
        setPrice((cur) => (cur.trim() === "" || cur === auto.current.price ? p : cur));
        auto.current.price = p;
      }
      setImageUrl(product.image ?? "");
      setStatus("ok");
    }, delay);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [url, kind, looksLikeUrl]);

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
          <div className="field">
            <label htmlFor="title">{kind === "exact" ? "Что именно" : "Какое направление"}</label>
            <input id="title" name="title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "exact" ? "Kindle Paperwhite 16 ГБ, чёрный" : "Что-то для домашнего кофе"} />
          </div>
          {kind === "exact" ? (
            <>
              <div className="field">
                <label htmlFor="url">Ссылка на товар</label>
                <input id="url" name="url" type="url" inputMode="url" value={url} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://www.wildberries.ru/catalog/..." />
                {status === "loading" && <div className="parse-hint loading"><span className="parse-dot" />Ищу товар…</div>}
                {status === "ok" && <div className="parse-hint ok">Нашли товар, проверьте название и цену</div>}
                {status === "fail" && <div className="parse-hint">Не удалось прочитать страницу, заполните вручную</div>}
              </div>
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
