#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Building..."
npm run build
docker build -t openclaw-logs-viewer:latest .

echo "Deploying..."
docker stop openclaw-logs-viewer 2>/dev/null || true
docker rm openclaw-logs-viewer 2>/dev/null || true
docker run -d \
  --name openclaw-logs-viewer \
  --restart unless-stopped \
  --network dokploy-network \
  -v /home/ubuntu/.openclaw:/home/ubuntu/.openclaw:rw \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.logs-http.entryPoints=web" \
  -l "traefik.http.routers.logs-http.rule=Host(\`logs.lolking.me\`) || Host(\`stark.tail102eb6.ts.net\`)" \
  -l "traefik.http.routers.logs-https.entryPoints=websecure" \
  -l "traefik.http.routers.logs-https.rule=Host(\`logs.lolking.me\`) || Host(\`stark.tail102eb6.ts.net\`)" \
  -l "traefik.http.routers.logs-https.tls=true" \
  -l "traefik.http.routers.logs-https.tls.certresolver=letsencrypt" \
  -l "traefik.http.services.logs.loadbalancer.server.port=3099" \
  openclaw-logs-viewer:latest

sleep 4
echo "Verifying..."
curl -s -o /dev/null -w "HTTP %{http_code}" https://logs.lolking.me/
echo ""
docker logs openclaw-logs-viewer --tail 3
echo "✓ Deployed"
