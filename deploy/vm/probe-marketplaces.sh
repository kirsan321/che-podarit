#!/usr/bin/env bash
# Egress check from this host: do the marketplaces answer to a plain request from this IP?
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
echo "egress: $(curl -s -m 8 https://api.ipify.org)"
for U in "https://ozon.ru/t/4KvgHzx" "https://www.ozon.ru/product/apple-smartfon-iphone-17-pro-max-esim-only-12-256-gb-esim-serebristyy-4875516340/" "https://www.ozon.ru/api/composer-api.bx/page/json/v2?url=/product/4875516340/" "https://market.yandex.ru/card/umnyy-svetilnik-yandeks-embi-lampa-rabotayet-s-alisoy-yndx-00560/5144580825" "https://card.wb.ru/cards/v4/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=1167502010"; do
  printf '%-90s ' "${U:0:90}"; curl -s -m 15 -A "$UA" -o /tmp/p.out -w "%{http_code} loc=%{redirect_url}" "$U" | cut -c1-140; echo; grep -oiE "og:title|smartcaptcha|__rr=|incidentId|\"products\"" /tmp/p.out | sort | uniq -c | head -3 | sed 's/^/    /'
done
