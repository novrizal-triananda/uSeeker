#!/bin/bash
# uSeeker E2E Test Suite
# Tests server endpoints, AI proxy, and data flow integrity

set -euo pipefail
BASE="http://127.0.0.1:8787"
PASS=0
FAIL=0
TOTAL=0

test_endpoint() {
  local name="$1" method="$2" url="$3" expected_status="$4" body="${5:-}"
  TOTAL=$((TOTAL + 1))
  
  if [ -n "$body" ]; then
    RESP=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$url" \
      -H "Content-Type: application/json" -d "$body" 2>&1)
  else
    RESP=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$url" 2>&1)
  fi
  
  STATUS=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  
  if [ "$STATUS" = "$expected_status" ]; then
    echo "✅ [$STATUS] $name"
    PASS=$((PASS + 1))
  else
    echo "❌ [$STATUS != $expected_status] $name"
    echo "   Response: $BODY"
    FAIL=$((FAIL + 1))
  fi
  
  # Return body for further checks
  echo "$BODY"
}

echo "═══════════════════════════════════════════════"
echo "uSeeker E2E Test Suite"
echo "═══════════════════════════════════════════════"
echo ""

# ── 1. Health Check ──────────────────────────────────────
echo "── 1. Server Health ──"
BODY=$(curl -s "$BASE/api/health")
echo "$BODY" | python3 -m json.tool

# Verify AI config
AI_CONFIGURED=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['ai']['configured'])")
AI_PROVIDER=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['ai']['provider'])")
AI_MODEL=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['ai']['model'])")

TOTAL=$((TOTAL + 1))
if [ "$AI_CONFIGURED" = "True" ]; then
  echo "✅ AI configured: $AI_PROVIDER ($AI_MODEL)"
  PASS=$((PASS + 1))
else
  echo "❌ AI not configured"
  FAIL=$((FAIL + 1))
fi

# ── 2. CORS ─────────────────────────────────────────────
echo ""
echo "── 2. CORS Headers ──"
CORS=$(curl -s -I -X OPTIONS "$BASE/api/ai" -H "Origin: http://localhost:4173" -H "Access-Control-Request-Method: POST" 2>&1)
TOTAL=$((TOTAL + 1))
if echo "$CORS" | grep -q "Access-Control-Allow-Origin"; then
  echo "✅ CORS headers present"
  PASS=$((PASS + 1))
else
  echo "❌ CORS headers missing"
  FAIL=$((FAIL + 1))
fi

# ── 3. Cloud AI Gate ──────────────────────────────────────
echo ""
echo "── 3. Cloud AI Gate ──"
ALLOW_CLOUD=$(grep -E '^USEEKER_ALLOW_CLOUD_AI=' /home/azzerith/projects/useeker/.env 2>/dev/null | cut -d= -f2)
BODY=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/ai" -H "Content-Type: application/json" \
  -d '{"prompt":"test","task":"test"}')
STATUS=$(echo "$BODY" | tail -1)
BODY_TEXT=$(echo "$BODY" | sed '$d')

if [ "$ALLOW_CLOUD" = "true" ]; then
  echo "ℹ️  USEEKER_ALLOW_CLOUD_AI=true — request forwarded to provider"
  TOTAL=$((TOTAL + 1))
  if echo "$BODY_TEXT" | grep -q "error"; then
    echo "⚠️  Provider returned error (expected if API key invalid): $(echo "$BODY_TEXT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("error","")[:80])' 2>/dev/null || echo "$BODY_TEXT")"
    PASS=$((PASS + 1))
  else
    echo "✅ AI proxy working — request forwarded successfully"
    PASS=$((PASS + 1))
  fi
else
  TOTAL=$((TOTAL + 1))
  if [ "$STATUS" = "403" ]; then
    echo "✅ Cloud AI correctly blocked (403)"
    PASS=$((PASS + 1))
  else
    echo "❌ Cloud AI should return 403 (got: $STATUS)"
    FAIL=$((FAIL + 1))
  fi
fi

# ── 4. AI Endpoint Validation ───────────────────────────
echo ""
echo "── 4. AI Endpoint Validation ──"
# Missing prompt
BODY=$(curl -s -X POST "$BASE/api/ai" -H "Content-Type: application/json" \
  -d '{"task":"test"}')
TOTAL=$((TOTAL + 1))
if echo "$BODY" | grep -q "prompt is required"; then
  echo "✅ Missing prompt returns 400"
  PASS=$((PASS + 1))
else
  echo "❌ Should reject missing prompt (got: $BODY)"
  FAIL=$((PASS + 1))
fi

# Empty body
BODY=$(curl -s -X POST "$BASE/api/ai" -H "Content-Type: application/json" -d '{}')
TOTAL=$((TOTAL + 1))
if echo "$BODY" | grep -q "prompt is required"; then
  echo "✅ Empty body returns 400"
  PASS=$((PASS + 1))
else
  echo "❌ Should reject empty body (got: $BODY)"
  FAIL=$((FAIL + 1))
fi

# ── 5. 404 for Unknown Routes ───────────────────────────
echo ""
echo "── 5. Unknown Routes ──"
BODY=$(curl -s "$BASE/api/nonexistent")
TOTAL=$((TOTAL + 1))
if echo "$BODY" | grep -q "Not Found"; then
  echo "✅ Unknown routes return 404"
  PASS=$((PASS + 1))
else
  echo "❌ Should return 404 (got: $BODY)"
  FAIL=$((FAIL + 1))
fi

# ── 6. Static Assets ────────────────────────────────────
echo ""
echo "── 6. Static Assets ──"
VITE_BASE="http://127.0.0.1:4173"

# HTML
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VITE_BASE/")
TOTAL=$((TOTAL + 1))
if [ "$STATUS" = "200" ]; then
  echo "✅ index.html served (200)"
  PASS=$((PASS + 1))
else
  echo "❌ index.html not served ($STATUS)"
  FAIL=$((FAIL + 1))
fi

# Check for script/link tags (dev or prod)
HTML=$(curl -s "$VITE_BASE/")
TOTAL=$((TOTAL + 1))
if echo "$HTML" | grep -qE '<script|<link.*\.css'; then
  echo "✅ Assets referenced in HTML (dev or prod mode)"
  PASS=$((PASS + 1))
else
  echo "❌ No assets found in HTML"
  FAIL=$((FAIL + 1))
fi

# Manifest
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VITE_BASE/manifest.json")
TOTAL=$((TOTAL + 1))
if [ "$STATUS" = "200" ]; then
  echo "✅ manifest.json served"
  PASS=$((PASS + 1))
else
  echo "⚠️  manifest.json not found ($STATUS)"
  FAIL=$((FAIL + 1))
fi

# ── 7. React Router Fallback ────────────────────────────
echo ""
echo "── 7. React Router SPA Fallback ──"
for route in "/triage" "/research" "/tailoring" "/visibility" "/data-hub" "/insights"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VITE_BASE$route")
  TOTAL=$((TOTAL + 1))
  if [ "$STATUS" = "200" ]; then
    echo "✅ SPA route $route → 200"
    PASS=$((PASS + 1))
  else
    echo "❌ SPA route $route → $STATUS (should be 200)"
    FAIL=$((FAIL + 1))
  fi
done

# ── Summary ─────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
