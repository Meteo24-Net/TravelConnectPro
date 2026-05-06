#!/usr/bin/env bash
# =============================================================================
# TCP — First clean push to GitHub
# Run this from inside the project folder (where this script lives)
# =============================================================================
set -euo pipefail

REPO="https://github.com/Meteo24-Net/TravelConnectPro.git"

echo "Initialising git..."
git init
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"

echo "Staging all files..."
git add .

echo "Creating commit..."
git commit -m "feat: TCP monorepo scaffold — migrations, tests, Edge Functions, CI

Migrations (supabase/migrations/):
  - 20260429000000_initial_schema.sql       26 tables, RLS, 6 RPCs, 31 indexes
  - 20260430000000_white_label_welcome.sql  branding + welcome template library
  - 20260506000000_service_request_v2.sql  priority col + SLA index

Tests (supabase/tests/):
  - schema_test.sql         91 pgTAP assertions (plan fixed from 95→91)
  - welcome_schema_test.sql 37 pgTAP assertions (plan fixed from 35→37)

Edge Functions (supabase/functions/):
  - service-request/        guest request → catalog lookup → DB → Telegram
  - _shared/helpers.ts      Telegram, device_hash, HMAC, CORS

Packages:
  - packages/types/         DB types shell + domain types
  - packages/utils/         3-client Supabase factory

Apps (HTML prototypes only — Next.js apps TBD):
  - apps/admin/prototypes/   v1 → v1.4 admin dashboard mockups
  - apps/display/prototypes/ lobby-pin, neon-slots
  - apps/pwa/prototypes/     service-requests

CI: .github/workflows/ci.yml — pgTAP + type check + lint on every PR"

echo "Pushing to main..."
git branch -M main
git push -u origin main --force

echo ""
echo "Done. Repo: $REPO"
echo ""
echo "Next steps:"
echo "  1. GitHub Settings > Secrets > Actions:"
echo "     SUPABASE_ACCESS_TOKEN  (from supabase.com/dashboard/account/tokens)"
echo "     SUPABASE_DB_PASSWORD   (from Dashboard > Settings > Database)"
echo "  2. supabase link --project-ref pjyjblllcllnqsjbvbfc"
echo "  3. supabase db push"
echo "  4. supabase test db"
echo "  5. supabase functions deploy service-request --project-ref pjyjblllcllnqsjbvbfc"
