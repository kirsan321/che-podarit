import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user?.id ?? "").maybeSingle();
  const name = profile?.display_name || user?.email || "";
  return (
    <div className="app">
      <div className="top"><h1>Профиль</h1></div>
      <div className="sub">{name}<br />{user?.email}</div>
      <form action={signOut}>
        <button className="btn ghost press" type="submit">Выйти</button>
      </form>
      <BottomNav active="profile" />
    </div>
  );
}
