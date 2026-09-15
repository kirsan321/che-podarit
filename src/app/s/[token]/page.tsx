import type { Metadata } from "next";
import Link from "next/link";
import "@/app/give.css";
import { fmtPrice } from "@/lib/types";
import { IconBox } from "@/components/icons";
import { IconChevronRight } from "@/components/give/GiveIcons";
import { loadPublicList } from "@/lib/give/data";
import { plural, rangeText } from "@/lib/give/format";
import { InvalidLink } from "./give/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Список желаний",
  robots: { index: false, follow: false },
};

export default async function PublicListPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const { valid, rows } = await loadPublicList(token);
  if (!valid) return <InvalidLink />;

  const owner = rows[0]?.owner_name ?? "Список";
  const exact = rows.filter((r) => r.kind === "exact");
  const directions = rows.filter((r) => r.kind === "direction");
  const free = rows.filter((r) => !r.reserved).length;

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
                <div className="b">{rangeText(it.price_min, it.price_max)}{it.reserved ? " · уже дарят" : ""}</div>
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

      {free > 0 ? (
        <>
          <Link href={`/s/${token}/give`} className="btn press" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20, textDecoration: "none" }}>
            Выбрать подарок <IconChevronRight />
          </Link>
          <div className="hint" style={{ textAlign: "center" }}>Бюджет, свайпы и бронь — чтобы двое не подарили одно и то же.</div>
        </>
      ) : rows.length > 0 ? (
        <div className="pub-cta"><b>Всё уже дарят</b>Каждое желание из списка кто-то забронировал. Загляните позже: список может пополниться.</div>
      ) : null}
      <div className="pub-foot"><Link href="/login">чЁ подарить</Link> · свой список за минуту · <Link href="/g">мои подарки</Link></div>
    </div>
  );
}
