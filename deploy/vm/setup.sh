#!/usr/bin/env bash
# One-time VM setup (Ubuntu 24.04): Docker, nginx, certbot, app checkout. Run as root.
set -euo pipefail
DOMAIN="${1:?usage: setup.sh <domain>}"
apt-get update -q
apt-get install -y -q ca-certificates curl git nginx certbot python3-certbot-nginx
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/che && cd /opt/che
[ -d repo ] || git clone https://github.com/kirsan321/che-podarit repo
cat > /etc/nginx/sites-available/che <<NGX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 6m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
NGX
ln -sf /etc/nginx/sites-available/che /etc/nginx/sites-enabled/che
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "Setup done. Put secrets into /opt/che/repo/.env, then run deploy/vm/deploy.sh. After DNS points here: certbot --nginx -d $DOMAIN"
