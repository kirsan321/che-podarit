import Link from "next/link";
import { IconGift, IconHeart, IconUser } from "./icons";

export function BottomNav({ active }: { active: "list" | "give" | "profile" }) {
  return (
    <nav className="nav">
      <Link href="/list" className={active === "list" ? "on" : ""}><IconGift />Список</Link>
      <Link href="/give" className={active === "give" ? "on" : ""}><IconHeart />Дарю</Link>
      <Link href="/profile" className={active === "profile" ? "on" : ""}><IconUser />Профиль</Link>
    </nav>
  );
}
