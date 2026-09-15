import type { Metadata } from "next";
import Link from "next/link";
import "@/app/give.css";
import { BudgetStep } from "@/components/give/BudgetStep";
import { loadPublicList } from "@/lib/give/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Выбрать подарок", robots: { index: false, follow: false } };

export default async function GiveBudgetPage({ params }: PageProps<"/s/[token]/give">) {
  const { token } = await params;
  const { valid, rows } = await loadPublicList(token);
  if (!valid) return <InvalidLink />;
  const owner = rows[0]?.owner_name ?? "Список";
  const active = rows.filter((r) => !r.reserved);
  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <BudgetStep
        token={token}
        owner={owner}
        items={rows.map((r) => ({ kind: r.kind, price: r.price, price_min: r.price_min, reserved: r.reserved }))}
        exactCount={active.filter((r) => r.kind === "exact").length}
        directionCount={active.filter((r) => r.kind === "direction").length}
      />
    </div>
  );
}

export function InvalidLink() {
  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <div className="pub-head"><h1>Ссылка не работает</h1><p>Её отозвали или в адресе опечатка. Попросите новую ссылку у владельца списка.</p></div>
      <div className="pub-foot"><Link href="/login">чЁ подарить</Link> · свой список за минуту</div>
    </div>
  );
}
