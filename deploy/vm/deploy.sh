#!/usr/bin/env bash
# Build and (re)start the app from the current main. Run on the VM as root.
set -euo pipefail
cd /opt/che/repo
git fetch -q origin && git checkout -q main && git reset -q --hard origin/main
set -a; . ./.env; set +a
docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
sleep 3
curl -sf http://127.0.0.1:3000/api/health && echo && echo "deployed $(git rev-parse --short HEAD)"
