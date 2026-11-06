#!/bin/sh
# After deploy:  sh scripts/smoke.sh https://pulse.yourcompany.com   (creates a throw-away test account and deletes it)
B="${1:?usage: smoke.sh https://your-domain}"; E="smoke$(date +%s)@example.com"; ok(){ echo "PASS $1"; }; bad(){ echo "FAIL $1"; FAIL=1; }
curl -fsS "$B/health" | grep -q '"ok":true' && ok "api health" || bad "api health"
curl -fsS "$B/solutions/whatsapp" | grep -qi "pulse" && ok "web page" || bad "web page"
T=$(curl -fsS -X POST "$B/api/pulse/auth/signup" -H 'content-type: application/json' -d "{\"email\":\"$E\",\"password\":\"smoke-test-123\",\"company\":\"Smoke Test\"}" | sed 's/.*"token":"\([^"]*\)".*/\1/')
[ -n "$T" ] && ok "signup" || bad "signup"
curl -fsS "$B/api/pulse/me" -H "authorization: Bearer $T" | grep -q '"plan"' && ok "login session" || bad "login session"
curl -fsS "$B/api/pulse/billing" -H "authorization: Bearer $T" | grep -q '"configured":true' && ok "payments configured" || bad "payments NOT configured (Razorpay env)"
curl -fsS "$B/api/pulse/config" | grep -q '"fbAppId":"' && ok "one-click WhatsApp connect configured" || bad "one-click connect NOT configured (FB_APP_ID / WA_CONFIG_ID)"
curl -fsS -X DELETE "$B/api/pulse/account" -H "authorization: Bearer $T" -H 'content-type: application/json' -d '{"password":"smoke-test-123"}' | grep -q '"ok":true' && ok "cleanup" || bad "cleanup"
[ -z "$FAIL" ] && echo "ALL GOOD" || { echo "Some checks failed"; exit 1; }
