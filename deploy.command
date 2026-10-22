#!/bin/bash
# Double-click to (re)deploy Reading Record to kiyoguan.cc
set -e
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  if grep -q '^TUNNEL_TOKEN=' "$HOME/wp-blog/.env" 2>/dev/null; then
    grep '^TUNNEL_TOKEN=' "$HOME/wp-blog/.env" > .env && chmod 600 .env
    echo "Copied tunnel token from ~/wp-blog/.env"
  else
    echo "No tunnel token found. Create .env here with TUNNEL_TOKEN=..."; exit 1
  fi
fi
if [ -f "$HOME/wp-blog/docker-compose.yml" ] && [ -n "$(cd "$HOME/wp-blog" && docker compose ps -q 2>/dev/null)" ]; then
  echo "Stopping the old WordPress site (its data in ~/wp-blog is kept)…"
  (cd "$HOME/wp-blog" && docker compose stop)
fi
docker compose up -d --build
echo
docker compose ps
echo
echo "Done. Preview locally: http://web.reading-record.orb.local:3000   Live: https://kiyoguan.cc"
echo "You can close this window."
