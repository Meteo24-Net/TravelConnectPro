'use client'

import WeatherWidget from '../sidebar/WeatherWidget'
import InfoBlock     from '../sidebar/InfoBlock'
import QrCarousel    from '../sidebar/QrCarousel'
import TickerBar     from '../ticker/TickerBar'
import FlightsPanel  from '../main/FlightsPanel'
import MapPanel      from '../map/MapPanel'

interface Rate    { currency: string; buy: number; sell: number; flag: string }
interface QrItem  { qr_id: string; label: string; sidebar_label: string | null; category: string; destination_url: string; tier: string }
interface Airport { iata_code: string; airport_name: string; drive_time_minutes: number | null }
interface Flight  { flight_number: string; destination: string; scheduled: string; status: string; gate?: string }

interface MapCfg {
  primary_provider: 'maplibre_osm' | 'mapbox' | 'tomtom'
  fallback_provider: string
  show_traffic: boolean
  default_zoom: number
  center?: [number, number]
  mapbox_token?: string
  tomtom_key?: string
}

interface Props {
  // Branding
  hotelName:    string
  logoUrl:      string | null
  accentGold:   string
  primaryColor: string
  bgColor:      string
  timezone:     string
  city:         string
  lat:          number
  lon:          number

  // Carousel state (controlled by parent)
  mainPanelView: 'flights' | 'map' | string
  airports:      Airport[]
  flights:       Record<string, Flight[]>  // keyed by iata_code
  mapConfig:     MapCfg

  // Sidebar
  rates:     Rate[]
  sidebarQrs: QrItem[]

  // Ticker
  announcements: string[]
  events:        string[]
  offers:        string[]

  // Clock
  clock: string
  date:  string
}

export default function LandscapeLayout(props: Props) {
  const {
    hotelName, logoUrl, accentGold, primaryColor, bgColor, timezone, city, lat, lon,
    mainPanelView, airports, flights, mapConfig,
    rates, sidebarQrs,
    announcements, events, offers,
    clock, date,
  } = props

  const activeAirport = airports[0] // for now show first airport; MainPanel rotates

  return (
    <div
      style={{
        width: '100vw', height: '100vh',
        background: bgColor || '#0a0a0e',
        display: 'grid',
        gridTemplateColumns: '2.6fr 1fr',
        gap: 20, padding: 20,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: 'white',
        overflow: 'hidden',
      }}
    >
      {/* ─── LEFT CARD ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(10,10,15,0.98)',
        borderLeft: `12px solid #003366`,
        borderRadius: '0 20px 20px 0',
        padding: 30,
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
      }}>
        {/* Brand header */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            {logoUrl ? (
              <img src={logoUrl} alt={hotelName} style={{ height: 90, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            ) : (
              <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, fontWeight: 700, letterSpacing: 2, color: accentGold }}>
                {hotelName}
              </div>
            )}
          </div>
          {/* Clock in header */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: 'white', letterSpacing: 2, fontFamily: '"JetBrains Mono", monospace' }}>{clock}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{date}</div>
          </div>
        </div>

        {/* Main panel viewport — slides between flights / map / games */}
        <div style={{ flex: '1 1 0', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
          {/* Flights */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: mainPanelView === 'flights' ? 1 : 0,
            transition: 'opacity 0.8s ease',
            pointerEvents: mainPanelView === 'flights' ? 'auto' : 'none',
          }}>
            {activeAirport && (
              <FlightsPanel
                iataCode={activeAirport.iata_code}
                airportName={activeAirport.airport_name}
                driveMinutes={activeAirport.drive_time_minutes ?? 20}
                accentGold={accentGold}
                flights={flights[activeAirport.iata_code]}
              />
            )}
          </div>

          {/* Map */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: mainPanelView === 'map' ? 1 : 0,
            transition: 'opacity 0.8s ease',
            pointerEvents: mainPanelView === 'map' ? 'auto' : 'none',
          }}>
            <MapPanel
              config={mapConfig}
              hotelLat={lat}
              hotelLon={lon}
              label={`${city.toUpperCase()} AREA`}
            />
          </div>
        </div>

        {/* Ticker bar */}
        <TickerBar
          announcements={announcements}
          events={events}
          offers={offers}
          accentGold={accentGold}
        />
      </div>

      {/* ─── RIGHT SIDEBAR ──────────────────────────────────────────────────── */}
      <div style={{
        background: '#0c0c0e',
        borderRadius: 25,
        padding: 25,
        display: 'flex', flexDirection: 'column',
        gap: 15,
        border: '1px solid #222',
        justifyContent: 'space-between',
        height: '100%', overflow: 'hidden',
      }}>
        {/* Weather widget — top, flex:1 */}
        <div style={{
          position: 'relative', width: '100%', flex: '1 1 0',
          background: '#121216', border: '1px solid #2a2a35',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '8px 15px', background: '#08080a', borderBottom: '1px solid #2a2a35', fontWeight: 600, fontSize: 11, color: '#b0b0b0', letterSpacing: 1.5, textAlign: 'center' }}>
            WEATHER
          </div>
          <WeatherWidget city={city} lat={lat} lon={lon} timezone={timezone} />
        </div>

        {/* Currency / Solar slider */}
        <InfoBlock rates={rates} />

        {/* QR carousel — bottom */}
        <QrCarousel items={sidebarQrs} />
      </div>
    </div>
  )
}
