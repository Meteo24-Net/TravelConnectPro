#!/usr/bin/env bash
# =============================================================================
# Travel Connect Pro — Dev Environment Bootstrap
# Run once after cloning: ./scripts/bootstrap.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()  { echo -e "${BLUE}[TCP]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK ]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fatal() { echo -e "${RED}[ERR ]${NC} $1"; exit 1; }

info "Travel Connect Pro — bootstrapping dev environment"
echo ""

# ─── 1. Check prerequisites ──────────────────────────────────────────────────
info "Checking prerequisites..."

command -v node  >/dev/null 2>&1 || fatal "Node.js 20+ is required. Install from https://nodejs.org"
command -v npm   >/dev/null 2>&1 || fatal "npm 10+ is required."
command -v git   >/dev/null 2>&1 || fatal "git is required."
command -v docker >/dev/null 2>&1 || fatal "Docker is required for local Supabase. Install from https://docker.com"

NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt 20 ]; then
  fatal "Node.js 20+ required, found Node $NODE_VERSION"
fi
ok "Node $(node -v), npm $(npm -v)"

# ─── 2. Install Supabase CLI ─────────────────────────────────────────────────
if ! command -v supabase >/dev/null 2>&1; then
  warn "Supabase CLI not found — installing via npm..."
  npm install -g supabase
  ok "Supabase CLI installed: $(supabase --version)"
else
  ok "Supabase CLI: $(supabase --version)"
fi

# ─── 3. Install npm dependencies ─────────────────────────────────────────────
info "Installing npm workspace dependencies..."
npm install
ok "npm dependencies installed"

# ─── 4. Create local .env.local from example ─────────────────────────────────
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  warn ".env.local created from .env.example — FILL IN real keys before running supabase start"
else
  ok ".env.local already exists"
fi

# ─── 5. Link Supabase project ────────────────────────────────────────────────
info "Linking to Supabase project pjyjblllcllnqsjbvbfc..."
info "You'll need your SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)"
echo ""

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  warn "SUPABASE_ACCESS_TOKEN not set. Skipping remote link."
  warn "Run: export SUPABASE_ACCESS_TOKEN=<token> && supabase link --project-ref pjyjblllcllnqsjbvbfc"
else
  supabase link --project-ref pjyjblllcllnqsjbvbfc
  ok "Project linked"
fi

# ─── 6. Start local Supabase ─────────────────────────────────────────────────
info "Starting local Supabase (Docker required)..."
supabase start

# ─── 7. Apply migrations locally ─────────────────────────────────────────────
info "Applying migrations..."
supabase db reset
ok "Migrations applied"

# ─── 8. Run schema tests ─────────────────────────────────────────────────────
info "Running pgTAP test suite..."
supabase test db
ok "Schema tests passed"

# ─── 9. Generate TypeScript types ────────────────────────────────────────────
info "Generating TypeScript types from local schema..."
supabase gen types typescript --local > packages/types/src/database.ts
ok "Types generated at packages/types/src/database.ts"

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} TCP dev environment is ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local — add real Supabase keys, Telegram token, API keys"
echo "  2. npm run dev:admin   → admin dashboard on :3000"
echo "  3. npm run dev:display → TV display app on :3001"
echo "  4. npm run dev:pwa     → guest PWA on :3002"
echo ""
echo "Supabase Studio: http://127.0.0.1:54323"
echo "Supabase API:    http://127.0.0.1:54321"
echo ""
