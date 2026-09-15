"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { ensureShareLink, regenerateShareLink } from "@/app/list/actions";

export function ShareSheet({ name, initialToken, onClose, onToast }: { name: string; initialToken: string | null; onClose: () => void; onToast: (t: string) => void }) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [qr, setQr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const url = token && typeof window !== "undefined" ? `${window.location.origin}/s/${token}` : null;

  useEffect(() => {
    if (!token) start(async () => {
      try { const s = await ensureShareLink(); setToken(s.token); }
      catch { onToast("Не удалось создать ссылку, попробуйте ещё раз"); onClose(); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#1d1d1f", light: "#ffffff" } }).then((d) => { if (alive) setQr(d); });
    return () => { alive = false; };
  }, [url]);

  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); onToast("Ссылка скопирована"); }
    catch { onToast("Не удалось скопировать, выделите вручную"); }
  }
  async function share() {
    if (!url) return;
    if (navigator.share) {
      try { await navigator.share({ title: `Список желаний: ${name}`, text: "Выбери подарок из моего списка, чтобы не гадать", url }); return; } catch { /* cancelled */ }
    }
    copy();
  }
  function regenerate() {
    if (!confirm("Старая ссылка перестанет открываться у всех, кому вы её отправили. Продолжить?")) return;
    start(async () => {
      try { const s = await regenerateShareLink(); setToken(s.token); setQr(null); onToast("Новая ссылка готова"); }
      catch { onToast("Не получилось, попробуйте ещё раз"); }
    });
  }

  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />
        <h2>Поделиться списком</h2>
        <div className="hint" style={{ marginBottom: 12 }}>Дарители откроют список по ссылке без регистрации. Скрытые желания они не увидят.</div>
        <div className="share-link">
          <input readOnly value={url ?? "Готовлю ссылку…"} onFocus={(e) => e.currentTarget.select()} aria-label="Ссылка на список" />
          <button className="press" type="button" onClick={copy} disabled={!url}>Копировать</button>
        </div>
        <div className="qr">{qr ? <img src={qr} alt="QR-код ссылки на список" width={220} height={220} /> : <div className="qr-skeleton" />}</div>
        <button className="btn press" type="button" onClick={share} disabled={!url || pending}>Отправить</button>
        <button className="btn ghost press" type="button" onClick={regenerate} disabled={!url || pending}>Новая ссылка, старую отозвать</button>
        <button className="btn ghost press" type="button" onClick={onClose}>Закрыть</button>
      </div>
    </>
  );
}
