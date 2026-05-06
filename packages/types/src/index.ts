// =============================================================================
// Travel Connect Pro — Domain Types
// =============================================================================

// ─── Tenant ──────────────────────────────────────────────────────────────────

export type HotelStatus = 'trial' | 'active' | 'suspended'
export type HotelTier   = 'basic' | 'premium' | 'enterprise'
export type IntegrationMode = 'solo' | 'otrum' | 'hybrid'

export interface HotelBranding {
  logo: {
    url: string | null
    fallback_text_line1: string   // e.g. "RADISSON BLU"
    fallback_text_line2: string   // e.g. "BATUMI"
  }
  colors: {
    primary:      string          // hex — main brand color
    accent_gold:  string          // hex — secondary accent
    accent_blue:  string          // hex — TCP blue default: #009FE3
    background:   string          // css color — display app BG
  }
  fonts: {
    pairing:    'classic' | 'modern' | 'editorial' | 'tech' | 'custom'
    heading:    string            // e.g. "Playfair Display"
    body:       string            // e.g. "Inter"
    custom_url: string | null     // only when pairing='custom'
  }
}

// ─── QR ──────────────────────────────────────────────────────────────────────

export type QRTier = 'open' | 'verified'

/** Tier-1: open — no proximity proof needed. e.g. menu, WiFi, city guide */
export interface Tier1QRPayload {
  tier:     'open'
  hotel_id: string
  asset_id: string
  url:      string
}

/** Tier-2: verified — requires geofence or lobby PIN before unlock */
export interface Tier2QRPayload {
  tier:     'verified'
  hotel_id: string
  asset_id: string
  token:    string    // HMAC-signed, expires in 15 min
}

export type QRPayload = Tier1QRPayload | Tier2QRPayload

// ─── Display App ─────────────────────────────────────────────────────────────

export type SlideType =
  | 'welcome'
  | 'weather'
  | 'flights'
  | 'exchange'
  | 'sports'
  | 'promo'
  | 'wifi'
  | 'service_request'
  | 'custom'

export interface SlideConfig {
  type:          SlideType
  duration_ms:   number
  enabled:       boolean
  content?:      Record<string, unknown>   // slide-type-specific payload
}

// ─── Analytics (no PII) ──────────────────────────────────────────────────────

/** device_hash = SHA256(UA + day_salt + hotel_id) — never reversed */
export type DeviceHash = string & { readonly __brand: 'DeviceHash' }

export interface AnalyticsEvent {
  hotel_id:    string
  device_hash: DeviceHash
  event_type:  string
  asset_id?:   string
  metadata?:   Record<string, Json>
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

// ─── Service Requests ────────────────────────────────────────────────────────

export type ServiceRequestStatus =
  | 'pending'
  | 'acknowledged'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type ServiceRequestPriority = 'low' | 'normal' | 'high' | 'urgent'

// ─── Telegram ────────────────────────────────────────────────────────────────

export interface TelegramNotification {
  hotel_id:  string
  chat_id:   string          // per-hotel manager_chat_id from DB
  message:   string          // Markdown-formatted
  parse_mode?: 'Markdown' | 'HTML'
}
