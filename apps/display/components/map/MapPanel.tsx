'use client'

import { useEffect, useRef } from 'react'

interface MapConfig {
  primary_provider:  'maplibre_osm' | 'mapbox' | 'tomtom'
  fallback_provider: string
  show_traffic:      boolean
  default_zoom:      number
  center?:           [number, number]
  mapbox_token?:     string
  tomtom_key?:       string
}

interface Props {
  config:   MapConfig
  hotelLat: number
  hotelLon: number
  label?:   string
}

// ── MapLibre (free, OpenStreetMap) ────────────────────────────────────────────
function MapLibreMap({ lat, lon, zoom, label }: { lat: number; lon: number; zoom: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    let map: unknown

    const script = document.createElement('script')
    script.src   = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
    script.onload = () => {
      const link  = document.createElement('link')
      link.rel    = 'stylesheet'
      link.href   = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
      document.head.appendChild(link)

      const ML = (window as Window & { maplibregl: unknown }).maplibregl as {
        Map: new (opts: unknown) => { addControl: (c: unknown) => void; remove: () => void; addLayer: (l: unknown) => void }
        NavigationControl: new () => unknown
      }

      const m = new ML.Map({
        container: ref.current!,
        style:     'https://demotiles.maplibre.org/style.json',
        center:    [lon, lat],
        zoom,
        attributionControl: false,
      })

      map = m
    }
    document.head.appendChild(script)

    return () => {
      if (map) (map as { remove: () => void }).remove()
    }
  }, [lat, lon, zoom])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <div ref={ref} style={{ width: '100%', height: '100%', background: '#111' }} />
      <div style={{
        position: 'absolute', bottom: 25, right: 25,
        background: 'rgba(0,0,0,0.9)', border: '1px solid #009FE3',
        padding: '12px 18px', borderRadius: 8, fontSize: 14,
        fontWeight: 'bold', color: 'white', letterSpacing: 1,
        pointerEvents: 'none',
      }}>
        📍 {label ?? 'HOTEL AREA'}
      </div>
      <div style={{
        position: 'absolute', top: 25, right: 25,
        background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)',
        padding: '6px 14px', borderRadius: 6, fontSize: 11,
        color: '#ffcc00', fontWeight: 'bold', letterSpacing: 1,
      }}>
        🗺️ OSM — no live traffic on free tier
      </div>
    </div>
  )
}

// ── Mapbox (paid, live traffic) ───────────────────────────────────────────────
function MapboxMap({ lat, lon, zoom, token, showTraffic, label }: {
  lat: number; lon: number; zoom: number
  token: string; showTraffic: boolean; label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    let map: { remove: () => void } | null = null

    const link  = document.createElement('link')
    link.rel    = 'stylesheet'
    link.href   = 'https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.css'
    document.head.appendChild(link)

    const script   = document.createElement('script')
    script.src     = 'https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.js'
    script.onload  = () => {
      const MB = (window as Window & { mapboxgl: unknown }).mapboxgl as {
        Map: new (opts: unknown) => {
          remove: () => void
          addSource: (id: string, src: unknown) => void
          addLayer:  (layer: unknown) => void
          on: (ev: string, cb: () => void) => void
        }
        accessToken: string
      }

      MB.accessToken = token
      const m = new MB.Map({
        container: ref.current!,
        style:     'mapbox://styles/mapbox/dark-v11',
        center:    [lon, lat],
        zoom,
        attributionControl: false,
      })
      map = m

      if (showTraffic) {
        m.on('load', () => {
          m.addSource('mapbox-traffic', { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' })
          m.addLayer({
            id: 'traffic', type: 'line',
            source: 'mapbox-traffic', 'source-layer': 'traffic',
            paint: { 'line-width': 2, 'line-color': ['match', ['get', 'congestion'], 'low', '#2ecc71', 'moderate', '#ffcc00', 'heavy', '#ff7e00', 'severe', '#ff4d4d', '#2ecc71'] },
          })
        })
      }
    }
    document.head.appendChild(script)

    return () => { map?.remove() }
  }, [lat, lon, zoom, token, showTraffic])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <div ref={ref} style={{ width: '100%', height: '100%', background: '#111' }} />
      <div style={{
        position: 'absolute', bottom: 25, right: 25,
        background: 'rgba(0,0,0,0.9)', border: '1px solid #009FE3',
        padding: '12px 18px', borderRadius: 8, fontSize: 14,
        fontWeight: 'bold', color: 'white', letterSpacing: 1, pointerEvents: 'none',
      }}>
        📍 {label ?? 'BATUMI AREA'}: {showTraffic ? 'LIVE TRAFFIC & SATELLITE' : 'SATELLITE'}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function MapPanel({ config, hotelLat, hotelLon, label }: Props) {
  const center = config.center ?? [hotelLon, hotelLat]
  const zoom   = config.default_zoom ?? 13
  const lon    = center[0]
  const lat    = center[1]

  const useMapbox = config.primary_provider === 'mapbox' && !!config.mapbox_token
  const useTomTom = config.primary_provider === 'tomtom' && !!config.tomtom_key

  if (useMapbox) {
    return <MapboxMap lat={lat} lon={lon} zoom={zoom} token={config.mapbox_token!} showTraffic={config.show_traffic} label={label} />
  }

  if (useTomTom) {
    // TomTom: use their Maps SDK web — loads via script tag same pattern
    // For now falls through to MapLibre with a note (TomTom SDK integration = next milestone)
    return <MapLibreMap lat={lat} lon={lon} zoom={zoom} label={label} />
  }

  // Default: free MapLibre/OSM
  return <MapLibreMap lat={lat} lon={lon} zoom={zoom} label={label} />
}
