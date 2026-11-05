#!/usr/bin/env bash
# The migration flow's browser evidence (issue #493), captured from the
# verified dev server with headless Chromium driven through chromedriver.
# Every capture is a real page state of this checkout at the recorded URL;
# the preflight provenance record beside these captures gates the URL.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PORT=9517
BASE="http://127.0.0.1:$PORT"
URL="http://localhost:5173/"
OUT="docs/evidence/issue-493"
SEED="$OUT/seed-v12.json"

session() { curl -s -X POST "$BASE/session" -d '{
  "capabilities": {"alwaysMatch": {
    "browserName": "chrome",
    "goog:chromeOptions": {
      "binary": "/usr/bin/chromium",
      "args": ["--headless=new", "--disable-gpu", "--no-first-run", "--window-size=1280,1200", "--hide-scrollbars"]
    }
  }}
}'; }

SID=$(session | python3 -c "import json,sys; print(json.load(sys.stdin)['value']['sessionId'])")
trap 'curl -s -X DELETE "$BASE/session/$SID" >/dev/null' EXIT

go() { curl -s -X POST "$BASE/session/$SID/url" -d "{\"url\": \"$1\"}" >/dev/null; }

exec_js() {
  local payload
  payload=$(python3 - "$1" "${2-}" <<'PY'
import json, sys
script, arg = sys.argv[1], sys.argv[2]
args = [{"seed": arg}] if arg else []
print(json.dumps({"script": script, "args": args}))
PY
)
  curl -s -X POST "$BASE/session/$SID/execute/sync" -d "$payload"
}

shot() { curl -s "$BASE/session/$SID/screenshot" | python3 -c "
import json, sys, base64
data = json.load(sys.stdin)['value']
open(sys.argv[1], 'wb').write(base64.b64decode(data))
" "$1"; }

rect() { curl -s -X POST "$BASE/session/$SID/window/rect" -d "$1" >/dev/null; }

wait_text() {
  for _ in $(seq 1 40); do
    if exec_js "return document.getElementById('modal-content')?.textContent?.includes('$1') ?? false" | grep -q '"value":true'; then return 0; fi
    sleep 0.5
  done
  echo "TIMEOUT waiting for: $1" >&2; return 1
}

seed_js='const [a] = arguments; window.__flowsynth?.dispose(); localStorage.setItem("flowsynth.save.v1", a.seed); localStorage.removeItem("flowsynth.save.original.v1"); return localStorage.getItem("flowsynth.save.v1").length;'

echo "== desktop: boot migration explainer"
go "$URL?dev=1"
sleep 1.2
exec_js "$seed_js" "$(cat "$SEED")" >/dev/null
go "$URL"
wait_text "calibrated economy"
shot "$OUT/desktop-migration-explainer.png"

echo "== desktop: disclosure opened by keyboard focus (the term trigger)"
exec_js "return (() => { const t = document.querySelector('#modal-content .term-trigger'); t?.focus(); return t?.getAttribute('aria-describedby') ?? null; })()" | grep -q catalog-term && echo "  term trigger focused" || echo "  WARN: no term trigger found"
sleep 0.3
shot "$OUT/desktop-migration-disclosure.png"
exec_js "return (() => { document.querySelector('#modal-content .term-trigger')?.blur(); return true; })()" >/dev/null

echo "== desktop: continue lands the calibrated board"
exec_js "return (() => { document.getElementById('migration-continue')?.click(); return true; })()" >/dev/null
sleep 0.8
shot "$OUT/desktop-migrated-board.png"

echo "== desktop: reload never explains again"
go "$URL?r=1"
sleep 1.5
silent=false
for _ in $(seq 1 10); do
  RAW=$(exec_js "return (() => { const t = document.getElementById('modal-content'); return JSON.stringify({ standing: !document.getElementById('modal')?.hidden && (t?.textContent?.includes('calibrated economy') ?? false) }); })()")
  echo "  raw: $RAW"
  if echo "$RAW" | grep -q 'standing\\\":false'; then silent=true; break; fi
  sleep 1
done
if [ "$silent" = true ]; then
  echo "  silent reload confirmed"
else
  echo "  RELOAD STILL EXPLAINS — aborting" >&2; exit 1
fi

echo "== desktop: the import path explains too"
exec_js "return (() => { window.__flowsynth.dispose(); localStorage.clear(); return true; })()" >/dev/null
go "$URL?dev=1"
sleep 1.2
exec_js "return (() => { document.getElementById('console-settings')?.click(); return true; })()" >/dev/null
sleep 0.4
exec_js "return (() => { document.getElementById('settings-import')?.click(); return true; })()" >/dev/null
sleep 0.4
exec_js "const [a] = arguments; const t = document.getElementById('import-text'); t.value = a.seed; return t.value.length;" "$(cat "$SEED")" >/dev/null
exec_js "return (() => { document.getElementById('import-apply')?.click(); return true; })()" >/dev/null
wait_text "calibrated economy"
ORIG=$(exec_js "return (localStorage.getItem('flowsynth.save.original.v1') ?? '').length;")
echo "$ORIG" | grep -q '"value":7634' && echo "  imported source bytes retained" || { echo "  ORIGINAL BYTES MISSING ($ORIG) — aborting" >&2; exit 1; }
shot "$OUT/desktop-import-explainer.png"
exec_js "return (() => { document.getElementById('migration-continue')?.click(); return true; })()" >/dev/null

echo "== phone: the same journey at 390x844"
rect '{"width": 390, "height": 987, "x": 0, "y": 0}'
go "$URL?dev=1"
sleep 1.2
exec_js "$seed_js" "$(cat "$SEED")" >/dev/null
go "$URL"
wait_text "calibrated economy"
shot "$OUT/phone-migration-explainer.png"
exec_js "return (() => { const t = document.querySelector('#modal-content .term-trigger'); t?.focus(); return true; })()" >/dev/null
sleep 0.3
shot "$OUT/phone-migration-disclosure.png"
exec_js "return (() => { document.getElementById('migration-continue')?.click(); return true; })()" >/dev/null
sleep 0.8
shot "$OUT/phone-migrated-board.png"

echo "== done: $(ls "$OUT"/*.png 2>/dev/null | wc -l) captures"
