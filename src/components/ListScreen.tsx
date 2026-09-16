"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deleteItem, setVisible } from "@/app/list/actions";
import { fmtPrice, type WishItem } from "@/lib/types";
import { AddSheet, type AddSheetPrefill } from "./AddSheet";
import { ShareSheet } from "./ShareSheet";
import { IconBox, IconCamera, IconEye, IconLink, IconPlus, IconShare } from "./icons";

type Filter = "all" | "visible" | "hidden";

export function ListScreen({ name, items, shareToken }: { name: string; items: WishItem[]; shareToken: string | null }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const router = useRouter();
  const params = useSearchParams();
  // Opened via the share target (/share -> /list?add=1&url=&title=): start with the sheet open and clean the URL.
  const [sheet, setSheet] = useState<{ open: boolean; url?: string; title?: string; prefill?: AddSheetPrefill }>(() =>
    params.get("add") === "1" ? { open: true, url: params.get("url") ?? undefined, title: params.get("title") ?? undefined } : { open: false },
  );
  useEffect(() => {
    if (params.get("add") === "1") router.replace("/list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pasteUrl, setPasteUrl] = useState("");
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  const active = items.filter((i) => i.status === "active");
  const shown = active.filter((i) => (filter === "all" ? true : filter === "visible" ? i.visible : !i.visible));
  const exact = shown.filter((i) => i.kind === "exact");
  const directions = shown.filter((i) => i.kind === "direction");
  const visibleCount = active.filter((i) => i.visible).length;

  function showToast(text: string, undo?: () => void) {
    setToast({ text, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function toggleEye(item: WishItem) {
    const next = !item.visible;
    if (navigator.vibrate) navigator.vibrate(8);
    startTransition(() => setVisible(item.id, next));
    showToast(next ? "Видно дарителям" : "Скрыто от дарителей", () => startTransition(() => setVisible(item.id, !next)));
  }
  function remove(item: WishItem) {
    startTransition(() => deleteItem(item.id));
    showToast("Удалено");
    setOpenItem(null);
  }
  const [openItem, setOpenItem] = useState<WishItem | null>(null);

  function openAdd(url?: string) {
    setSheet({ open: true, url });
    setPasteUrl("");
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const [recognizing, setRecognizing] = useState(false);
  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setRecognizing(true);
    showToast("Распознаю фото…");
    try {
      const { data, mediaType } = await downscale(file, 1024);
      const res = await fetch("/api/recognize-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: data, mediaType }) });
      const j = (await res.json()) as { ok: boolean; title?: string; price?: number | null; candidates?: AddSheetPrefill["candidates"]; error?: string };
      if (j.ok) setSheet({ open: true, title: j.title, prefill: { title: j.title, price: j.price ?? null, candidates: j.candidates ?? [], hint: "photo" } });
      else setSheet({ open: true, prefill: { hint: "photo-fail" } });
    } catch {
      setSheet({ open: true, prefill: { hint: "photo-fail" } });
    } finally {
      setRecognizing(false);
      setToast(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <>
      <div className="top">
        <div className="who">
          <div className="ava">{initial}</div>
          <div><b>{name}</b><small>{active.length ? `${active.length} ${plural(active.length, "желание", "желания", "желаний")}` : "пока пусто"}</small></div>
        </div>
        <button className="icon-btn share press" aria-label="Поделиться списком" onClick={() => setShareOpen(true)}><IconShare /></button>
      </div>

      <form className="paste" onSubmit={(e) => { e.preventDefault(); openAdd(pasteUrl.trim() || undefined); }}>
        <IconLink />
        <input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="Ссылка на товар или просто название" aria-label="Ссылка на товар" inputMode="url" />
        <button className="go press" type="submit">{pasteUrl ? "Добавить" : "Вручную"}</button>
        <button type="button" className="icon-btn press" style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.08)" }} aria-label="Сфотографировать или выбрать скриншот" disabled={recognizing} onClick={() => fileRef.current?.click()}><IconCamera size={18} /></button>
        <button type="button" className="icon-btn press" style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.08)" }} aria-label="Добавить желание" onClick={() => openAdd()}><IconPlus size={18} /></button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onPhoto(e.target.files?.[0])} />
      </form>

      <div className="row" style={{ paddingBottom: 4 }}>
        <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>Все <span className="cnt">{active.length}</span></button>
        <button className={"chip" + (filter === "visible" ? " on" : "")} onClick={() => setFilter("visible")}><IconEye size={14} /> Видно <span className="cnt">{visibleCount}</span></button>
        <button className={"chip" + (filter === "hidden" ? " on" : "")} onClick={() => setFilter("hidden")}><IconEye off size={14} /> Только я <span className="cnt">{active.length - visibleCount}</span></button>
      </div>

      {!active.length && (
        <div className="empty">
          <b>Список пуст</b>
          Вставьте ссылку с WB или Ozon в поле выше, или добавьте желание вручную.
        </div>
      )}

      {!!exact.length && (
        <>
          <div className="sec">Именно это <small>{exact.length}</small></div>
          <div className="grid">
            {exact.map((it) => (
              <button key={it.id} className={"card press" + (it.visible ? "" : " hidden")} onClick={() => setOpenItem(it)}>
                <div className="photo">
                  {it.image_url ? <img src={it.image_url} alt="" /> : <div className="img"><IconBox /></div>}
                  <span className={"badge " + (it.priority === "want" ? "want" : "exact")}>{it.priority === "want" ? "очень хочу" : "именно это"}</span>
                  <span role="button" tabIndex={0} className={"eye" + (it.visible ? "" : " off")} aria-label={it.visible ? "Видно дарителям" : "Скрыто от дарителей"}
                    onClick={(e) => { e.stopPropagation(); toggleEye(it); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggleEye(it); } }}>
                    <IconEye off={!it.visible} />
                  </span>
                </div>
                <div className="price">{fmtPrice(it.price) || "цена не указана"} {it.source && <span className={"src " + it.source}>{it.source.toUpperCase()}</span>}</div>
                <div className="name">{it.title}</div>
                {it.comment && <div className="meta">{it.comment}</div>}
              </button>
            ))}
          </div>
        </>
      )}

      {!!directions.length && (
        <>
          <div className="sec">Можно похожее <small>{directions.length} · не точная вещь</small></div>
          {directions.map((it) => (
            <button key={it.id} className={"wide press" + (it.visible ? "" : " hidden")} onClick={() => setOpenItem(it)}>
              <div className="thumb">{it.image_url ? <img src={it.image_url} alt="" /> : it.title.trim()[0]?.toUpperCase()}</div>
              <div>
                <div className="t">{it.title}</div>
                <div className="b">{rangeText(it.price_min, it.price_max)}</div>
                {(it.tags.length || it.anti_tags.length) ? (
                  <div className="tags">
                    {it.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                    {it.anti_tags.map((t) => <span key={"n" + t} className="tag no">{t}</span>)}
                  </div>
                ) : null}
              </div>
              <span role="button" tabIndex={0} className={"eye" + (it.visible ? "" : " off")} aria-label={it.visible ? "Видно дарителям" : "Скрыто от дарителей"}
                onClick={(e) => { e.stopPropagation(); toggleEye(it); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggleEye(it); } }}>
                <IconEye off={!it.visible} />
              </span>
            </button>
          ))}
        </>
      )}

      {shareOpen && <ShareSheet name={name} initialToken={shareToken} onClose={() => setShareOpen(false)} onToast={(t) => showToast(t)} />}

      {sheet.open && <AddSheet initialUrl={sheet.url} initialTitle={sheet.title} prefill={sheet.prefill} onClose={() => setSheet({ open: false })} onAdded={() => { setSheet({ open: false }); showToast("Добавлено"); }} />}

      {openItem && (
        <>
          <div className="sheet-bg" onClick={() => setOpenItem(null)} />
          <div className="sheet">
            <div className="grab" />
            <h2>{openItem.title}</h2>
            <div className="hint" style={{ marginBottom: 12 }}>
              {openItem.kind === "exact" ? fmtPrice(openItem.price) : rangeText(openItem.price_min, openItem.price_max)}
              {openItem.comment ? ` · ${openItem.comment}` : ""}
            </div>
            {openItem.url && <a className="btn ghost press" style={{ display: "grid", placeItems: "center", textDecoration: "none" }} href={openItem.url} target="_blank" rel="noopener noreferrer">Открыть товар</a>}
            <button className="btn ghost press" onClick={() => { toggleEye(openItem); setOpenItem(null); }}>{openItem.visible ? "Скрыть от дарителей" : "Показать дарителям"}</button>
            <button className="btn danger press" onClick={() => remove(openItem)}>Удалить</button>
          </div>
        </>
      )}

      <div className={"toast" + (toast ? " show" : "")} role="status">
        <span>{toast?.text}</span>
        {toast?.undo && <b role="button" onClick={() => { toast.undo?.(); setToast(null); }}>Вернуть</b>}
      </div>
    </>
  );
}

function rangeText(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${fmtPrice(min)}–${fmtPrice(max)}`;
  if (max != null) return `до ${fmtPrice(max)}`;
  if (min != null) return `от ${fmtPrice(min)}`;
  return "бюджет не указан";
}
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Downscales an image on the client so the upload stays small (~1024 px, JPEG). */
async function downscale(file: File, max: number): Promise<{ data: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { data: dataUrl.split(",")[1] ?? "", mediaType: "image/jpeg" };
}
