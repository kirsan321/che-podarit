import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/** What the vision model reads off a photo or a marketplace screenshot. */
export const RecognitionSchema = z.object({
  brand: z.string().nullable(),
  product: z.string().nullable(),
  variant: z.string().nullable(),
  category: z.string().nullable(),
  /** Price visible on the image (marketplace screenshot), in rubles; null when not visible. */
  price_rub: z.number().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});
export type Recognition = z.infer<typeof RecognitionSchema>;

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const SYSTEM = `You identify consumer products for a gift wishlist app used in Russia.
The image is either a photo of a product (packaging, label, the item itself) or a screenshot of a marketplace page (Wildberries, Ozon, Yandex Market).
Read what is actually written: brand, product name, model, variant (size, color, volume). Do not guess a brand or model that is not visible or clearly identifiable.
If a price in rubles is visible on the image, return it as a number; otherwise null.
Write product and variant in the language shown on the image (usually Russian); keep brand names as written.
Confidence: high = brand and model are clearly readable; medium = product type is clear but brand/model partly inferred; low = only a rough guess.`;

/** Calls the vision model. Throws SDK errors; callers decide how to degrade. */
export async function recognizeProduct(imageBase64: string, mediaType: ImageMediaType, client: Anthropic = new Anthropic()): Promise<Recognition | null> {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(RecognitionSchema), effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "Identify the product on this image." },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}

/** Builds the title shown in the add form and the search query for WB. Pure. */
export function titleFromRecognition(r: Recognition): string {
  const parts = [r.brand, r.product, r.variant].map((s) => (s ?? "").trim()).filter(Boolean);
  const title = parts.join(" ").replace(/\s+/g, " ").trim();
  return title.slice(0, 200);
}

export function queriesFromRecognition(r: Recognition): string[] {
  const full = titleFromRecognition(r);
  const short = [r.brand, r.product].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  return Array.from(new Set([full, short].filter((q) => q.length >= 3)));
}
