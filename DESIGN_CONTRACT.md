# 🔒 DESIGN CONTRACT — TravelConnectPro TV Display

> **READ THIS BEFORE TOUCHING ANY DISPLAY CODE.**
> This file defines the locked specification for the lobby TV dashboard.
> Violations of this contract will break the production display.

---

## Reference Design

The single source of truth is: `C:\Users\studio\OneDrive\Desktop\tbilisi.html`

All visual decisions, colors, sizing, and layout MUST match this file.

---

## Grid Layout (LOCKED)

```
┌─────────────────────────────────┬──────────────┐
│                                 │              │
│        LEFT CARD (2.6fr)        │  RIGHT (1fr) │
│                                 │   SIDEBAR    │
│  [Flights / Map / Games]        │              │
│  [Rotating panels]              │  [Weather]   │
│                                 │  [Currency]  │
│  [Ticker Bar at bottom]         │  [QR Codes]  │
│                                 │              │
└─────────────────────────────────┴──────────────┘
```

- Grid: `grid-template-columns: 2.6fr 1fr`
- Gap: `20px`, Padding: `20px`
- Background: `#000` (plain black, NO background images)

---

## Component Architecture (LOCKED)

### Entry Point
- `app/[screen_id]/page.tsx` → imports `DisplayDashboard`
- **There is ONE orchestrator**: `DisplayDashboard.tsx`
- ~~`DisplayApp.tsx`~~ — DELETED. Do not recreate.

### Component Tree
```
DisplayDashboard.tsx (orchestrator)
├── WelcomeOverlay.tsx (startup, slides away after 8s)
└── LandscapeLayout.tsx (persistent grid)
    ├── LEFT CARD
    │   ├── FlightsPanel.tsx (departure board)
    │   ├── MapPanel.tsx (city map)
    │   └── TickerBar.tsx (scrolling announcements)
    └── RIGHT SIDEBAR
        ├── WeatherWidget.tsx (full weather + AQI + UV)
        ├── InfoBlock.tsx (currency ↔ solar tracker, auto-rotates)
        └── QrCarousel.tsx (sliding QR codes)
```

### DO NOT MODIFY List
These components are **stable and complete**. Do not rewrite them:
- `WeatherWidget.tsx` — fetches from Open-Meteo, shows °C/°F, hourly, 3-day, AQI, UV
- `FlightsPanel.tsx` — departure board with smart departure times
- `TickerBar.tsx` — scrolling announcements/events/offers
- `WelcomeOverlay.tsx` — startup greeting

---

## Color Palette (LOCKED)

| Token | Value | Usage |
|-------|-------|-------|
| TBC Blue | `#009FE3` | Flight IDs, location pins, currency header |
| Radisson Blue | `#003366` | Left card border |
| Radisson Gold | `#c5a059` | Accent, ticker label, QR border |
| Background | `#000` | Main background |
| Glass Panel | `rgba(10,10,15,0.98)` | Left card background |
| Sidebar | `#0c0c0e` | Right sidebar background |
| Green | `#2ecc71` | Buy rates, "On Time" status |
| Red | `#ff4d4d` | Sell rates, "Cancelled" status |
| Yellow | `#ffcc00` | Solar tracker daylight, "Delayed" status |
| Muted text | `#b0b0b0` | Secondary labels |

**DO NOT** substitute with different colors. DO NOT use Tailwind color classes for display components.

---

## Styling Rules

1. **All TV display components use INLINE STYLES only**
   - No Tailwind utility classes in sidebar/display components
   - No custom CSS variables (they silently fail if undefined)
   - Tailwind is OK for admin dashboard only

2. **Why**: Inline styles are self-contained. If a component renders, its styles work.
   Tailwind classes depend on config, PostCSS, and purging — any mismatch = invisible breakage.

---

## Data Flow (LOCKED)

```
Supabase Edge Function (display-config)
  → resolve_display_integration_view RPC
    → Returns: { branding, content, airports, ticker, sidebar_qrs, ... }

DisplayDashboard.tsx (fetches config)
  → LandscapeLayout (receives all props)
    → WeatherWidget: fetches DIRECTLY from Open-Meteo API (not from config)
    → InfoBlock: receives rates[] from config.content.currency.rates
    → FlightsPanel: receives flights from config.content.flights
    → QrCarousel: receives sidebar_qrs[] from config
    → TickerBar: receives ticker.announcements/events/offers from config
```

---

## Change Process

1. **Read this file first**
2. **Check git status** — is the current state committed?
3. **Make small, targeted changes** — never rewrite entire files
4. **Test visually** — compare against tbilisi.html
5. **Commit** — `git commit -m "description of change"`
6. **If something breaks** — `git checkout -- .` to revert

---

*Last updated: 2026-05-14*
*Locked by: Engineering team after root cause analysis of repeated UI breakage*
