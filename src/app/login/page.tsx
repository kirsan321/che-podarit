import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/list";
  const mode = sp.mode === "signup" ? "signup" : "login";
  return (
    <div className="app">
      <div className="auth">
        <div className="logo">ч<span>Ё</span> подарить</div>
        <div className="tagline">Список желаний, из которого дарят без дублей и гаданий</div>
        <AuthForm next={next} initialMode={mode} />
      </div>
    </div>
  );
}
