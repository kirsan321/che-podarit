import { redirect } from "next/navigation";

// Proxy redirects "/" by session; this is a fallback.
export default function Home() {
  redirect("/login");
}
