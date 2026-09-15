"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastState { text: string; undo?: () => void }

export function useToast(timeoutMs = 4000) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, undo?: () => void) => {
    setToast({ text, undo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), timeoutMs);
  }, [timeoutMs]);
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { toast, show, hide };
}

export function Toast({ toast, onHide }: { toast: ToastState | null; onHide: () => void }) {
  return (
    <div className={"toast" + (toast ? " show" : "")} role="status" aria-live="polite">
      <span>{toast?.text}</span>
      {toast?.undo && (
        <button type="button" className="undo" onClick={() => { toast.undo?.(); onHide(); }}>Вернуть</button>
      )}
    </div>
  );
}
