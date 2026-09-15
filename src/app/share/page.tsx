import { redirect } from "next/navigation";
import { parseSharePayload } from "@/lib/share/parseShare";

export const dynamic = "force-dynamic";

// Web Share Target endpoint (see manifest.ts). Normalizes what the share sheet sent and hands it to the list.
export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const { url, title } = parseSharePayload({ title: pick("title"), text: pick("text"), url: pick("url") });
  const q = new URLSearchParams({ add: "1" });
  if (url) q.set("url", url);
  if (title) q.set("title", title);
  redirect(`/list?${q.toString()}`);
}
