import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtPrice } from "@/lib/types";
import { IconBox } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Список желаний",
  robots: { index: false, follow: false },
};

type Row = {
  wishlist_id: string; owner_name: string | null; item_id: string; kind: "exact" | "direction"; title: string;
  url: string | null; image_url: string | null; source: string | null; price: number | null; price_min: number | null;
  price_max: number | null; priority: "want" | "nice"; comment: string | null; tags: string[]; anti_tags: string[];
  occasion_tags: string[]; reserved: boolean;
};

export default async function PublicListPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_wishlist", { p_token: token });
  const rows = (data ?? []) as Row[];

  const valid = !error && (rows.length > 0 || (await supabase.rpc("share_link_valid", { p_token: token })).data === true);
  if (!valid) {
    return (
      <div className="app" style={{ paddingBottom: 24 }}>
        <div className="pub-head"><h1>Ссылка не работает</h1><p>Её отозвали или в адресе опечатка. Попросите новую ссылку у владельца списка.</p></div>
        <div className="pub-foot"><Link href="/login">чЁ подарить</Link> · свой список за минуту</div>
      </div>
    );
  }

  const owner = rows[0]?.owner_name ?? "Список";
  const exact = rows.filter((r) => r.kind === "exact");
  const directions = rows.filter((r) => r.kind === "direction");

  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <div className="pub-head">
        <h1>{owner}: что подарить</h1>
        <p>{rows.length ? `${rows.length} ${plural(rows.length, "желание", "желания", "желаний")} · выбирайте, что по душе` : "Список пока пуст"}</p>
      </div>

      {!!exact.length && (
        <>
          <div className="sec">Именно это <small>{exact.length}</small></div>
          <div className="grid">
            {exact.map((it) => (
              <a key={it.item_id} className="card-link card" href={it.url ?? undefined} target={it.url ? "_blank" : undefined} rel="noopener noreferrer">
                <div className="photo">
                  {it.image_url ? <img src={it.image_url} alt="" /> : <div className="img"><IconBox /></div>}
                  {it.priority === "want" && <span className="badge want">очень хочу</span>}
                  {it.reserved && <span className="reserved">уже дарят</span>}
                </div>
                <div className="price">{fmtPrice(it.price) || "цена не указана"} {it.source && <span className={"src " + it.source}>{it.source.toUpperCase()}</span>}</div>
                <div className="name">{it.title}</div>
                {it.comment && <div className="meta">{it.comment}</div>}
              </a>
            ))}
          </div>
        </>
      )}

      {!!directions.length && (
        <>
          <div className="sec">Можно похожее <small>{directions.length} · не точная вещь</small></div>
          {directions.map((it) => (
            <div key={it.item_id} className="wide">
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
                {it.comment && <div className="meta" style={{ marginTop: 4 }}>{it.comment}</div>}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="pub-cta">
        <b>Скоро: выбрать и забронировать</b>
        Чтобы двое не подарили одно и то же, здесь появится бронь подарка. Пока просто выбирайте из списка.
      </div>
      <div className="pub-foot"><Link href="/login">чЁ подарить</Link> · свой список за минуту</div>
    </div>
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
