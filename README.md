# Travel Connect Pro (TCP)

White-label hotel digital signage SaaS. Multi-tenant, Supabase-powered.

**Supabase project:** `pjyjblllcllnqsjbvbfc`  
**Dashboard:** https://supabase.com/dashboard/project/pjyjblllcllnqsjbvbfc  
**GitHub:** https://github.com/Meteo24-Net/TravelConnectPro

---

## Architecture

```
┌──────────────┬──────────────┬───────────────┬──────────────────┐
│  Lobby TV    │   Room TV    │  Guest PWA    │  Admin Dashboard │
│  (display)   │   (display)  │  (pwa)        │  (admin)         │
└──────┬───────┴──────┬───────┴──────┬────────┴────────┬─────────┘
       │              │              │                 │
       │     anon key + signed URLs  │       anon key + RLS session
       └──────────────┴──────────────┘                 │
                      │                                │
            ┌─────────▼─────────────────────┐          │
            │       EDGE FUNCTIONS           │◄─────────┘
            │  (only write path — svc role)  │
            └──────────────┬────────────────┘
                           │
            ┌──────────────▼────────────────┐
            │          SUPABASE              │
            │  Postgres · Realtime · Storage │
            │  pjyjblllcllnqsjbvbfc          │
            └───────────────────────────────┘
```

## Conventions

| Rule | Detail |
|---|---|
| Multi-tenancy | `hotel_id` on every tenant table; RLS isolates managers |
| Write path | Edge Functions only — anon key + signed URLs for reads |
| QR tiers | Tier-1: open. Tier-2: geofence/PIN proximity proof |
| Notifications | Telegram only — pipeline built in-house, no Zapier |
| Analytics | `device_hash = SHA256(UA + day_salt + hotel_id)` — no PII |
| Server-driven | Priority, SLA, caps — decided server-side, never by client |
| Branding | SuperAdmin sets palette/fonts; managers fill content |

## Repository structure

```
TravelConnectPro/
├── supabase/
│   ├── config.toml                              ← Supabase CLI config
│   ├── migrations/
│   │   ├── 20260429000000_initial_schema.sql    ← 26 tables, RLS, RPCs, indexes
│   │   ├── 20260430000000_white_label_welcome.sql
│   │   └── 20260506000000_service_request_v2.sql ← priority col, SLA index
│   ├── tests/
│   │   ├── schema_test.sql                      ← 91 pgTAP assertions
│   │   └── welcome_schema_test.sql              ← 37 pgTAP assertions
│   └── functions/
│       ├── _shared/helpers.ts                   ← Telegram, device hash, HMAC, CORS
│       └── service-request/index.ts             ← Guest request → DB + Telegram
│
├── apps/
│   ├── admin/prototypes/                        ← admin-v1 through v1_4 HTML mockups
│   ├── display/prototypes/                      ← lobby-pin, neon-slots mockups
│   └── pwa/prototypes/                          ← service-requests mockup
│
├── packages/
│   ├── types/src/                               ← DB types (gen) + domain types
│   └── utils/src/supabase.ts                    ← 3-client factory (browser/admin/service)
│
├── .github/workflows/ci.yml                     ← pgTAP + types + lint on every PR
├── scripts/bootstrap.sh                         ← One-command dev setup
└── .env.example                                 ← All required vars documented
```

## Quick start

```bash
git clone https://github.com/Meteo24-Net/TravelConnectPro
cd TravelConnectPro

# Requires: Docker, Node 20+, Supabase CLI
./scripts/bootstrap.sh
```

Manual:
```bash
npm install

export SUPABASE_ACCESS_TOKEN=<token>
supabase link --project-ref pjyjblllcllnqsjbvbfc
supabase db push          # apply all 3 migrations
supabase test db          # run 91 + 37 = 128 pgTAP assertions

npm run types:gen         # generates packages/types/src/database.ts

npm run dev:admin         # :3000
npm run dev:display       # :3001
npm run dev:pwa           # :3002
```

## GitHub Secrets required for CI

| Secret | Source |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD`  | Dashboard → Settings → Database |

## Migrations

| # | File | What it does |
|---|---|---|
| 1 | `20260429000000_initial_schema.sql` | 26 tables, all RLS, 6 RPCs, 31 indexes, seed hotel |
| 2 | `20260430000000_white_label_welcome.sql` | Branding cols, welcome template library |
| 3 | `20260506000000_service_request_v2.sql` | `priority` col + SLA index on service_requests |

## Edge Functions

| Function | Status | What it does |
|---|---|---|
| `service-request` | ✅ Ready | Guest request → catalog lookup → DB insert → Telegram |
| `display-config` | 🔜 Next | Signed display config for lobby/room screens |
| `verify-proximity` | 🔜 Next | Tier-2 QR geofence check |
| `lobby-pin` | 🔜 Next | Tier-2 QR PIN verification |
| `analytics-event` | 🔜 Next | device_hash event recording |
| `weather-refresh` | 🔜 Next | pg_cron → fetch → cache |
| `flights-refresh` | 🔜 Next | pg_cron → fetch → cache |
