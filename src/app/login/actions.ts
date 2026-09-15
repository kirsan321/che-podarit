"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string } | undefined;

function ruError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Неверная почта или пароль";
  if (m.includes("already registered") || m.includes("already been registered")) return "Такая почта уже зарегистрирована. Попробуйте войти";
  if (m.includes("password") && m.includes("at least")) return "Пароль слишком короткий, нужно минимум 6 символов";
  if (m.includes("invalid email") || m.includes("validate email")) return "Проверьте адрес почты";
  if (m.includes("rate limit")) return "Слишком много попыток, подождите минуту";
  return "Не получилось. Попробуйте ещё раз";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/list");
  if (!email || !password) return { error: "Заполните почту и пароль" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: ruError(error.message) };
  redirect(next.startsWith("/") ? next : "/list");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Как вас зовут? Это имя увидят дарители" };
  if (!email || !password) return { error: "Заполните почту и пароль" };
  if (password.length < 6) return { error: "Пароль минимум 6 символов" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
  if (error) return { error: ruError(error.message) };
  redirect("/list");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
