/**
 * Reverse Latin transliteration used in Ozon / Yandex Market URL slugs
 * ("zhenskaya-kurtka-uteplennaya" -> "женская куртка утепленная"). Heuristic, good enough for search queries.
 */
const MULTI: Array<[string, string]> = [
  ["shch", "щ"], ["sch", "щ"], ["yo", "ё"], ["zh", "ж"], ["kh", "х"], ["ts", "ц"], ["ch", "ч"], ["sh", "ш"],
  ["yu", "ю"], ["ya", "я"], ["ye", "е"], ["yy", "ый"], ["iy", "ий"], ["ij", "ий"], ["eh", "э"],
];
const SINGLE: Record<string, string> = {
  a: "а", b: "б", v: "в", g: "г", d: "д", e: "е", z: "з", i: "и", j: "й", k: "к", l: "л", m: "м", n: "н",
  o: "о", p: "п", r: "р", s: "с", t: "т", u: "у", f: "ф", h: "х", c: "ц", y: "ы", w: "в", x: "кс", q: "к",
};

export function detranslitWord(word: string): string {
  const w = word.toLowerCase();
  let out = "";
  for (let i = 0; i < w.length; ) {
    let hit = false;
    for (const [lat, cyr] of MULTI) {
      if (w.startsWith(lat, i)) { out += cyr; i += lat.length; hit = true; break; }
    }
    if (hit) continue;
    const ch = w[i];
    out += SINGLE[ch] ?? ch;
    i += 1;
  }
  // "y" after a vowel is "й", not "ы": alisoy -> алисой, sayt -> сайт
  return out.replace(/([аеиоуыэюяё])ы/g, "$1й");
}

/**
 * Tokens that should stay Latin: model numbers, sizes, and words that do not look like transliterated Russian
 * (brand names such as apple, byredo, lafamily). Russian-looking = has a typical digraph or ending.
 */
const RU_DIGRAPH = /zh|kh|ts|ch|sh|yu|ya|yy|iy|ij|ye|yo|shch/;
const RU_ENDING = /(aya|yaya|yy|iy|ov|ova|ovo|ev|eva|ka|ki|nik|ost|ina|ino|oy|ey|ie|ye|ii|nyy|nye|ami|ykh|ikh|ogo|ego|omu|emu|ye|yakh|ok|ek|ets|tsa|tsy|sya|isya)$/;
const RU_SHORT = new Set(["s", "v", "k", "i", "na", "po", "dlya", "iz", "ot", "do", "u", "o", "ne"]);
function keepLatin(word: string): boolean {
  if (/\d/.test(word)) return true;
  if (RU_SHORT.has(word)) return false;
  if (word.length <= 3) return true;
  return !(RU_DIGRAPH.test(word) || RU_ENDING.test(word));
}

export function detranslit(text: string): string {
  return text.split(/\s+/).filter(Boolean).map((w) => (keepLatin(w) ? w : detranslitWord(w))).join(" ");
}

/** Turns a slug into a readable title: "komplekt-odezhdy-lafamily" -> "Комплект одежды lafamily". */
export function slugToTitle(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").replace(/\b\d{6,}\b/g, "").replace(/\s+/g, " ").trim();
  if (!words) return "";
  const cyr = detranslit(words);
  return cyr.charAt(0).toUpperCase() + cyr.slice(1);
}
