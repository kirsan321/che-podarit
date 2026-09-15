import { redirect } from "next/navigation";

// Legacy anonymous path; /give now serves both anonymous and logged-in givers.
export default function GiverEventsLegacyPage() {
  redirect("/give");
}
