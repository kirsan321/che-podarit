import { describe, expect, it } from "vitest";
import { detranslit, slugToTitle } from "../translit";

describe("detranslit", () => {
  it("reverses common Ozon/YM slug transliteration", () => {
    expect(detranslit("zhenskaya kurtka uteplennaya siniy")).toBe("женская куртка утепленная синий");
    expect(detranslit("umnyy svetilnik yandeks lampa rabotayet s alisoy")).toBe("умный светилник яндекс lampa работает с алисой");
    expect(detranslit("parfyumernaya voda")).toBe("парфюмерная voda");
  });
  it("keeps sizes, model numbers and brand-looking words latin", () => {
    expect(detranslit("kurtka xs 256 gb yndx-00560")).toBe("куртка xs 256 gb yndx-00560");
    expect(detranslit("apple smartfon iphone 17 pro max serebristyy")).toBe("apple smartfon iphone 17 pro max серебристый");
    expect(detranslit("byredo bal d afrique")).toBe("byredo bal d afrique");
  });
  it("makes a readable title from a slug and drops the numeric id", () => {
    expect(slugToTitle("komplekt-odezhdy-lafamily-987874603")).toBe("Komplekt одежды lafamily");
    expect(slugToTitle("")).toBe("");
  });
});
