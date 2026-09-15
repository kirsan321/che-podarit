export type ProductSource = "wb" | "ozon" | "ym" | "lamoda" | "other";

export interface ParsedProduct {
  title: string;
  image: string | null;
  price: number | null;
  currency: "RUB";
  url: string;
  source: ProductSource;
  confidence: "high" | "low";
}
