import { IconBox } from "@/components/icons";
import type { GiveItem } from "@/lib/give/types";
import { fmtPrice } from "@/lib/types";
import { rangeText } from "@/lib/give/format";

/** Square image or a placeholder; direction items get the warm gradient. */
export function ItemThumb({ item, className }: { item: Pick<GiveItem, "image_url" | "kind" | "title">; className: string }) {
  return (
    <div className={className + (item.kind === "direction" && !item.image_url ? " dir" : "")}>
      {item.image_url ? <img src={item.image_url} alt="" draggable={false} /> : <IconBox />}
    </div>
  );
}

/** Price for exact items, budget range for directions. */
export function itemPrice(item: Pick<GiveItem, "kind" | "price" | "price_min" | "price_max">): string {
  if (item.kind === "direction") return rangeText(item.price_min, item.price_max);
  return fmtPrice(item.price) || "цена не указана";
}
