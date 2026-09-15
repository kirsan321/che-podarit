"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/login/actions";

export function AuthForm({ next, initialMode }: { next: string; initialMode: "login" | "signup" }) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(signIn, undefined);
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signUp, undefined);
  const isLogin = mode === "login";
  const state = isLogin ? loginState : signupState;
  const pending = isLogin ? loginPending : signupPending;

  return (
    <form action={isLogin ? loginAction : signupAction}>
      <div className="seg" role="tablist">
        <button type="button" className={isLogin ? "on" : ""} onClick={() => setMode("login")}>Войти</button>
        <button type="button" className={!isLogin ? "on" : ""} onClick={() => setMode("signup")}>Создать список</button>
      </div>
      <input type="hidden" name="next" value={next} />
      {!isLogin && (
        <div className="field">
          <label htmlFor="name">Имя, которое увидят дарители</label>
          <input id="name" name="name" autoComplete="name" placeholder="Нюта" required />
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Почта</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@mail.ru" required />
      </div>
      <div className="field">
        <label htmlFor="password">Пароль</label>
        <input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} placeholder="минимум 6 символов" required minLength={6} />
      </div>
      {state?.error && <div className="err">{state.error}</div>}
      <button className="btn press" type="submit" disabled={pending}>
        {pending ? "Секунду…" : isLogin ? "Войти" : "Создать список"}
      </button>
      <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>
        {isLogin ? "Ещё нет списка? Нажмите «Создать список»" : "Без подтверждения почты, сразу к списку"}
      </p>
    </form>
  );
}
