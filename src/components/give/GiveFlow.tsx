"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { confirmReservation, releaseReservation, reserveItems } from "@/lib/give/actions";
import { budgetText } from "@/lib/give/format";
import { readRaw, serverSnapshot, subscribe, writeRaw } from "@/lib/give/session";
import type { FinalItem, GiveItem } from "@/lib/give/types";
import { IconHeart } from "@/components/icons";
import { Deck } from "./Deck";
import { FinalScreen } from "./FinalScreen";
import { IconBack } from "./GiveIcons";
import { Shortlist } from "./Shortlist";
import { SlotMachine } from "./SlotMachine";
import { Toast, useToast } from "./Toast";

type Screen = "deck" | "short" | "slot" | "final";
type Dir = 1 | -1;

interface FlowState {
  queue: string[];
  hist: { id: string; dir: Dir }[];
  liked: string[];
  picked: string[];
  slotUsed: boolean;
  slotWinner: string | null;
  screen: Screen;
  final: { items: FinalItem[]; source: "manual" | "slot" } | null;
  /** Server snapshot id under which `final` was last changed on the client; see reconcile(). */
  finalSnapshot: string | null;
}

interface Props {
  token: string;
  eventId: string;
  owner: string;
  occasion: string | null;
  budget: number | null;
  items: GiveItem[];
  existing: FinalItem[];
  /** Random id of the server render that produced `items`/`existing`; changes on every refresh. */
  snapshot: string;
}

const storageKey = (eventId: string) => `give:${eventId}`;

function freshState(items: GiveItem[], existing: FinalItem[]): FlowState {
  return {
    queue: items.map((i) => i.id), hist: [], liked: [], picked: [], slotUsed: false, slotWinner: null,
    screen: existing.length ? "final" : "deck",
    final: existing.length ? { items: existing, source: "manual" } : null,
    finalSnapshot: null,
  };
}

function parseState(raw: string | null): FlowState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<FlowState>;
    if (!Array.isArray(s.queue) || !Array.isArray(s.liked)) return null;
    return {
      queue: s.queue, hist: Array.isArray(s.hist) ? s.hist : [], liked: s.liked, picked: Array.isArray(s.picked) ? s.picked : [],
      slotUsed: !!s.slotUsed, slotWinner: s.slotWinner ?? null, screen: s.screen ?? "deck", final: s.final ?? null,
      finalSnapshot: typeof s.finalSnapshot === "string" ? s.finalSnapshot : null,
    };
  } catch {
    return null;
  }
}

/**
 * Reconcile persisted state with what the server currently offers: drop items reserved elsewhere, add newly
 * available ones. For the final screen: changes the client made under the current server snapshot are ahead of
 * the props and win; otherwise the server's active reservations are the source of truth (a session that still
 * remembers a final screen the server no longer knows about is stale).
 */
function reconcile(s: FlowState, items: GiveItem[], existing: FinalItem[], snapshot: string): FlowState {
  const avail = new Set(items.map((i) => i.id));
  const seen = new Set([...s.queue, ...s.liked, ...s.hist.map((h) => h.id)]);
  const finalIds = new Set([...existing.map((f) => f.id), ...(s.final?.items ?? []).map((f) => f.id)]);
  const queue = s.queue.filter((id) => avail.has(id));
  for (const it of items) if (!seen.has(it.id) && !finalIds.has(it.id)) queue.push(it.id);
  const liked = s.liked.filter((id) => avail.has(id));
  const likedSet = new Set(liked);
  const picked = s.picked.filter((id) => likedSet.has(id));
  const slotWinner = likedSet.has(s.slotWinner ?? "") ? s.slotWinner : null;
  // A reload mid-spin replays the reel with the same stored winner; only bail out if that item is gone.
  let screen: Screen = s.screen === "slot" && !slotWinner ? "short" : s.screen;
  let final = s.final;
  if (s.finalSnapshot === snapshot) {
    // Client is ahead of the server props (just reserved/released/confirmed); keep it until the props catch up.
  } else if (existing.length) {
    const stored = new Map((s.final?.items ?? []).map((f) => [f.reservation_id, f]));
    final = {
      items: existing.map((e) => ({ ...e, confirmed: e.confirmed || !!stored.get(e.reservation_id)?.confirmed })),
      source: s.final?.source ?? "manual",
    };
    screen = "final";
  } else if (screen === "final" || final) {
    final = null;
    screen = "short";
  }
  return { ...s, queue, liked, picked, screen, final, slotWinner };
}

export function GiveFlow({ token, eventId, owner, occasion, budget, items, existing, snapshot }: Props) {
  const router = useRouter();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [busy, setBusy] = useState(false);
  const [busyRes, setBusyRes] = useState<string | null>(null);
  const [slotKey, setSlotKey] = useState(0);
  const { toast, show, hide } = useToast();
  const removed = useRef<GiveItem | null>(null);

  // sessionStorage is the store: progress survives reloads, and the server's view of reservations wins on every render.
  const key = storageKey(eventId);
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), serverSnapshot);
  const state = useMemo<FlowState | null>(
    () => (raw === undefined ? null : reconcile(parseState(raw) ?? freshState(items, existing), items, existing, snapshot)),
    [raw, items, existing, snapshot],
  );
  // Event handlers read the freshest state from the store (never from a stale closure or a ref during render).
  const current = useCallback(
    () => reconcile(parseState(readRaw(key)) ?? freshState(items, existing), items, existing, snapshot),
    [key, items, existing, snapshot],
  );
  const update = useCallback((fn: (s: FlowState) => FlowState) => {
    writeRaw(key, JSON.stringify(fn(current())));
  }, [key, current]);
  const go = useCallback((screen: Screen) => { update((s) => ({ ...s, screen })); window.scrollTo(0, 0); }, [update]);

  const queueItems = state ? state.queue.map((id) => byId.get(id)).filter((x): x is GiveItem => !!x) : [];
  const likedItems = state ? state.liked.map((id) => byId.get(id)).filter((x): x is GiveItem => !!x) : [];

  // ----- deck -----
  const swipe = (dir: Dir) => update((s) => {
    const [id, ...rest] = s.queue;
    if (!id) return s;
    return { ...s, queue: rest, hist: [...s.hist, { id, dir }], liked: dir > 0 ? [...s.liked, id] : s.liked };
  });
  const undo = () => update((s) => {
    const h = s.hist[s.hist.length - 1];
    if (!h) return s;
    return { ...s, hist: s.hist.slice(0, -1), queue: [h.id, ...s.queue], liked: h.dir > 0 ? s.liked.filter((x) => x !== h.id) : s.liked };
  });

  // ----- shortlist -----
  const toggle = (id: string) => update((s) => ({ ...s, picked: s.picked.includes(id) ? s.picked.filter((x) => x !== id) : [...s.picked, id] }));
  const remove = (id: string) => {
    const g = byId.get(id) ?? null;
    removed.current = g;
    update((s) => ({ ...s, liked: s.liked.filter((x) => x !== id), picked: s.picked.filter((x) => x !== id) }));
    show("Убрано", () => {
      const r = removed.current;
      if (!r) return;
      removed.current = null;
      update((s) => (s.liked.includes(r.id) ? s : { ...s, liked: [...s.liked, r.id] }));
    });
  };

  // ----- reservation -----
  async function finish(ids: string[], source: "manual" | "slot") {
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      const res = await reserveItems(token, eventId, ids);
      const ok: FinalItem[] = [];
      const taken: string[] = [];
      let failed = 0;
      for (const r of res) {
        const g = byId.get(r.itemId);
        if ("reservationId" in r && g) ok.push({ ...g, reservation_id: r.reservationId, confirmed: false });
        else if ("error" in r && r.error === "already_reserved") taken.push(r.itemId);
        else failed++;
      }
      if (taken.length) show("Этот подарок только что забронировали");
      else if (failed) show("Не получилось забронировать. Попробуйте ещё раз");
      update((s) => {
        const drop = new Set(taken);
        const next: FlowState = {
          ...s,
          queue: s.queue.filter((x) => !drop.has(x)),
          liked: s.liked.filter((x) => !drop.has(x)),
          picked: s.picked.filter((x) => !drop.has(x)),
        };
        if (ok.length) return { ...next, final: { items: [...(s.final?.items ?? []), ...ok], source }, finalSnapshot: snapshot, screen: "final", picked: [] };
        return { ...next, screen: "short" };
      });
      window.scrollTo(0, 0);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  const finishManual = () => { if (state) void finish(state.picked, "manual"); };
  const startSlot = () => {
    if (!state || state.slotUsed || likedItems.length < 2) return;
    const win = likedItems[Math.floor(Math.random() * likedItems.length)];
    setSlotKey((k) => k + 1);
    update((s) => ({ ...s, slotUsed: true, slotWinner: win.id, screen: "slot" }));
    window.scrollTo(0, 0);
  };
  const finishSlot = () => { if (state?.slotWinner) void finish([state.slotWinner], "slot"); };

  async function confirm(reservationId: string) {
    setBusyRes(reservationId);
    const { ok } = await confirmReservation(token, reservationId);
    setBusyRes(null);
    if (!ok) { show("Не получилось. Попробуйте ещё раз"); return; }
    update((s) => s.final ? { ...s, finalSnapshot: snapshot, final: { ...s.final, items: s.final.items.map((f) => f.reservation_id === reservationId ? { ...f, confirmed: true } : f) } } : s);
    show("Отмечено. Спасибо, что подарили");
    router.refresh();
  }
  async function release(reservationId: string) {
    setBusyRes(reservationId);
    const { ok } = await releaseReservation(token, reservationId);
    setBusyRes(null);
    if (!ok) { show("Не получилось. Попробуйте ещё раз"); return; }
    update((s) => {
      if (!s.final) return s;
      const items = s.final.items.filter((f) => f.reservation_id !== reservationId);
      const back = s.final.items.find((f) => f.reservation_id === reservationId);
      // Back to the shortlist; reconcile() hides it until the refreshed props offer the item again.
      const liked = back && !s.liked.includes(back.id) ? [...s.liked, back.id] : s.liked;
      return items.length ? { ...s, liked, finalSnapshot: snapshot, final: { ...s.final, items } } : { ...s, liked, finalSnapshot: snapshot, final: null, screen: "short" };
    });
    show("Бронь снята");
    router.refresh();
  }

  if (!state) return <div className="gload">Загружаем...</div>;

  const winner = state.slotWinner ? byId.get(state.slotWinner) : undefined;
  const title = <><b>{owner}</b><small>{[occasion, budgetText(budget)].filter(Boolean).join(" · ")}{state.screen === "deck" ? ` · ${state.queue.length} осталось` : ""}</small></>;

  return (
    <div className="app" style={{ paddingBottom: state.screen === "short" ? 200 : 24 }}>
      {state.screen === "deck" && (
        <>
          <div className="deck-top">
            <Link href={`/s/${token}/give`} className="back" aria-label="Назад"><IconBack /></Link>
            <div className="t">{title}</div>
            <div className="pill"><IconHeart /><i>{state.liked.length}</i></div>
          </div>
          <Deck queue={queueItems} likedCount={state.liked.length} canUndo={state.hist.length > 0} onSwipe={swipe} onUndo={undo} onDone={() => go("short")} />
        </>
      )}
      {state.screen === "short" && (
        <>
          <div className="top">
            <button type="button" className="back" onClick={() => go("deck")} aria-label="Назад"><IconBack /></button>
            <h1>Вы готовы подарить</h1>
          </div>
          <Shortlist liked={likedItems} picked={new Set(state.picked)} slotUsed={state.slotUsed} busy={busy} onToggle={toggle} onRemove={remove} onSlot={startSlot} onPick={finishManual} />
        </>
      )}
      {state.screen === "slot" && winner && (
        <SlotMachine key={slotKey} items={likedItems} winner={winner} busy={busy} onTake={finishSlot} onManual={() => go("short")} />
      )}
      {state.screen === "final" && state.final && (
        <FinalScreen token={token} items={state.final.items} source={state.final.source} busyId={busyRes} onConfirm={confirm} onRelease={release} />
      )}
      <Toast toast={toast} onHide={hide} />
    </div>
  );
}
