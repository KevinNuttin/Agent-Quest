#!/usr/bin/env bash
# Smoke test for the origin guard: loopback bind, CORS, POST and WebSocket.
# Starts its own server on a spare port and stops it on exit.
set -uo pipefail

PORT="${PORT:-4544}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="http://localhost:$PORT"
LOG="$(mktemp)"

(cd "$ROOT/server" && PORT="$PORT" exec bun run src/index.ts >"$LOG" 2>&1) &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null; rm -f "$LOG"' EXIT

for _ in $(seq 1 40); do
  curl -s -o /dev/null "$BASE/api/health" && break
  sleep 0.5
done

echo "== bind (attendu : 127.0.0.1:$PORT)"
lsof -nP -iTCP:"$PORT" -sTCP:LISTEN | tail -n +2 | awk '{print $9}'

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [[ -n "$LAN_IP" ]]; then
  echo "== accès via IP LAN $LAN_IP (attendu : refusé)"
  curl -s -m 2 -o /dev/null -w "%{http_code}\n" "http://$LAN_IP:$PORT/api/health" || echo "connexion refusée"
fi

echo "== POST /api/hooks/install depuis evil (attendu : 403)"
curl -s -X POST -H "Origin: https://evil.example" "$BASE/api/hooks/install" -w " %{http_code}\n"

echo "== POST hook sans Origin, comme Claude Code (attendu : 200)"
curl -s -X POST -H "content-type: application/json" -d '{"hook_event_name":"Other"}' \
  "$BASE/api/hooks/claude" -w " %{http_code}\n"

echo "== POST hook depuis le dashboard (attendu : 200)"
curl -s -X POST -H "Origin: http://localhost:4445" -H "content-type: application/json" \
  -d '{"hook_event_name":"Other"}' "$BASE/api/hooks/claude" -w " %{http_code}\n"

echo "== CORS depuis evil (attendu : aucun header)"
curl -s -D - -o /dev/null -H "Origin: https://evil.example" "$BASE/api/agents" \
  | grep -i access-control || echo "aucun header CORS"

echo "== CORS depuis le dashboard (attendu : header présent)"
curl -s -D - -o /dev/null -H "Origin: http://localhost:4445" "$BASE/api/agents" | grep -i access-control

echo "== WebSocket (attendu : evil REFUSÉ, dashboard OUVERT)"
PORT="$PORT" bun -e '
const url = `ws://localhost:${process.env.PORT}/ws`;
for (const origin of ["https://evil.example", "http://localhost:4445"]) {
  await new Promise((done) => {
    const ws = new WebSocket(url, { headers: { Origin: origin } });
    const timer = setTimeout(() => { console.log(origin, "-> timeout"); done(); }, 3000);
    ws.onmessage = () => { clearTimeout(timer); console.log(origin, "-> OUVERT"); ws.close(); done(); };
    ws.onerror = () => { clearTimeout(timer); console.log(origin, "-> REFUSÉ"); done(); };
  });
}
'
