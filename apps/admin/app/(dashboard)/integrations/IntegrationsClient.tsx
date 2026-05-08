'use client'

import { useState, useTransition } from 'react'
import { saveIntegrationKeysAction, saveMapConfigAction } from './actions'

const MAP_PROVIDERS = [
  { id: 'maplibre_osm', label: 'OpenStreetMap via MapLibre GL', cost: 'Free',    traffic: 'No live traffic on free tier' },
  { id: 'tomtom',       label: 'TomTom Maps',                  cost: 'Freemium', traffic: 'Live traffic included' },
  { id: 'mapbox',       label: 'Mapbox GL JS',                 cost: 'Paid',     traffic: 'Live traffic included' },
]

const API_KEY_FIELDS = [
  { key: 'mapbox_token',      label: 'Mapbox Token',         hint: 'pk.xxx — URL-restrict to your display domain', icon: '🗺️', group: 'map' },
  { key: 'tomtom_key',        label: 'TomTom API Key',       hint: 'From developer.tomtom.com',                   icon: '🗺️', group: 'map' },
  { key: 'sports_api_key',    label: 'Sports API Key',       hint: 'API-Sports.io — football, basketball, tennis', icon: '⚽', group: 'data' },
  { key: 'aviation_key',      label: 'AviationStack Key',    hint: 'aviationstack.com — live flight data',         icon: '✈️', group: 'data' },
  { key: 'openweather_key',   label: 'OpenWeather Key',      hint: 'Optional — overrides free Open-Meteo',        icon: '🌤️', group: 'data' },
  { key: 'exchange_rate_key', label: 'Exchange Rate Key',    hint: 'exchangerate-api.com or NBG direct',          icon: '💱', group: 'data' },
]

interface Props {
  hotelId:    string
  keys:       Record<string, string>
  mapConfig:  { primary_provider: string; fallback_provider: string; show_traffic: boolean; default_zoom: number }
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed bottom-4 right-4 px-4 py-3 rounded-lg text-sm font-medium shadow-lg z-50"
      style={{
        background: ok ? 'rgba(46,204,113,0.15)' : 'rgba(239,68,68,0.15)',
        border: `1px solid ${ok ? 'rgba(46,204,113,0.4)' : 'rgba(239,68,68,0.4)'}`,
        color:  ok ? 'var(--tcp-green)' : 'var(--tcp-red)',
      }}>
      {msg}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-secondary mb-1.5 font-medium">{label}</label>
      {children}
      {hint && <div className="text-tertiary mt-1" style={{ fontSize: 11 }}>{hint}</div>}
    </div>
  )
}

export default function IntegrationsClient({ hotelId, keys: initialKeys, mapConfig: initialMap }: Props) {
  const [keys, setKeys]           = useState<Record<string, string>>(initialKeys)
  const [mapCfg, setMapCfg]       = useState(initialMap)
  const [showKeys, setShowKeys]   = useState<Record<string, boolean>>({})
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  function setKey(k: string, v: string) { setKeys(prev => ({ ...prev, [k]: v })) }

  function saveKeys() {
    startTransition(async () => {
      const r = await saveIntegrationKeysAction(hotelId, keys)
      showToast(r.ok ? 'API keys saved securely' : r.error ?? 'Failed', r.ok)
    })
  }

  function saveMap() {
    startTransition(async () => {
      const r = await saveMapConfigAction(hotelId, mapCfg)
      showToast(r.ok ? 'Map config saved — TVs update within 5 min' : r.error ?? 'Failed', r.ok)
    })
  }

  const mapGroup    = API_KEY_FIELDS.filter(f => f.group === 'map')
  const dataGroup   = API_KEY_FIELDS.filter(f => f.group === 'data')
  const primaryProv = MAP_PROVIDERS.find(p => p.id === mapCfg.primary_provider)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>Integrations & API Keys</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          All external service keys. Stored encrypted, server-side only. Display app never receives raw keys.
        </p>
      </div>

      {/* Security notice */}
      <div className="phase-strip" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        <div className="text-sm text-secondary">
          Keys are stored in <strong className="text-primary">hotels.integration_keys</strong> — RLS-protected, SuperAdmin only.
          Edge Functions read them server-side. The display app only receives cached results, never raw keys.
          Exception: Mapbox token reaches the browser — <strong className="text-primary">URL-restrict it to your display domain.</strong>
        </div>
      </div>

      {/* Map configuration */}
      <div className="section-card" style={{ borderLeft: '3px solid var(--tcp-blue)' }}>
        <div className="section-head">
          <div className="section-title">Map provider</div>
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={saveMap} disabled={isPending}>
            Save map config
          </button>
        </div>
        <div className="section-body space-y-5">
          {/* Provider selector */}
          <div className="space-y-2">
            {MAP_PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setMapCfg(c => ({ ...c, primary_provider: p.id }))}
                className="w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-all"
                style={{
                  background:  mapCfg.primary_provider === p.id ? 'rgba(0,159,227,0.06)' : 'var(--bg-input)',
                  borderColor: mapCfg.primary_provider === p.id ? 'rgba(0,159,227,0.3)' : 'var(--border-subtle)',
                }}
              >
                <div className="shrink-0 rounded-full" style={{
                  width: 18, height: 18,
                  background: mapCfg.primary_provider === p.id ? 'var(--tcp-blue)' : 'transparent',
                  border: `2px solid ${mapCfg.primary_provider === p.id ? 'var(--tcp-blue)' : 'var(--border-default)'}`,
                }} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="flex gap-4 mt-1">
                    <span
                      className="tag"
                      style={{
                        color:       p.cost === 'Free' ? 'var(--tcp-green)' : p.cost === 'Paid' ? 'var(--tcp-amber)' : 'var(--tcp-blue)',
                        background:  p.cost === 'Free' ? 'rgba(46,204,113,0.1)' : p.cost === 'Paid' ? 'rgba(245,158,11,0.1)' : 'rgba(0,159,227,0.1)',
                        borderColor: p.cost === 'Free' ? 'rgba(46,204,113,0.3)' : p.cost === 'Paid' ? 'rgba(245,158,11,0.3)' : 'rgba(0,159,227,0.3)',
                        fontSize: 10,
                      }}
                    >
                      {p.cost}
                    </span>
                    <span className="text-tertiary" style={{ fontSize: 11 }}>{p.traffic}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Map options */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fallback provider (if primary fails)">
              <select className="select" value={mapCfg.fallback_provider}
                onChange={e => setMapCfg(c => ({ ...c, fallback_provider: e.target.value }))}>
                {MAP_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Default zoom level" hint="8 = country, 13 = city, 17 = street">
              <input className="input font-mono" type="number" min={8} max={20}
                value={mapCfg.default_zoom}
                onChange={e => setMapCfg(c => ({ ...c, default_zoom: parseInt(e.target.value) || 13 }))} />
            </Field>
          </div>

          {/* Traffic toggle */}
          <button
            onClick={() => setMapCfg(c => ({ ...c, show_traffic: !c.show_traffic }))}
            className="flex items-center gap-3 p-3 rounded-lg border text-left w-full"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)' }}
          >
            <div className="rounded-full shrink-0" style={{
              width: 40, height: 22,
              background: mapCfg.show_traffic ? 'var(--tcp-blue)' : 'rgba(255,255,255,0.1)',
              position: 'relative',
            }}>
              <div className="absolute rounded-full bg-white" style={{
                width: 16, height: 16, top: 3, transition: 'left 0.15s',
                left: mapCfg.show_traffic ? 21 : 3,
              }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Live traffic layer</div>
              <div className="text-tertiary" style={{ fontSize: 11 }}>
                {mapCfg.show_traffic
                  ? primaryProv?.traffic === 'No live traffic on free tier'
                    ? '⚠️ Not available on current provider — switch to TomTom or Mapbox'
                    : 'Traffic overlay active on TV screens'
                  : 'Map shows without traffic overlay'}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Map API keys */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-title">Map API keys</div>
        </div>
        <div className="section-body space-y-4">
          {mapGroup.map(f => (
            <div key={f.key} className="flex gap-3 items-start">
              <span style={{ fontSize: 20, marginTop: 8 }}>{f.icon}</span>
              <div className="flex-1">
                <Field label={f.label} hint={f.hint}>
                  <div className="flex gap-2">
                    <input
                      className="input font-mono flex-1"
                      type={showKeys[f.key] ? 'text' : 'password'}
                      value={keys[f.key] ?? ''}
                      onChange={e => setKey(f.key, e.target.value)}
                      placeholder="Enter key…"
                    />
                    <button
                      className="btn-ghost shrink-0"
                      style={{ padding: '8px 12px', fontSize: 12 }}
                      onClick={() => setShowKeys(s => ({ ...s, [f.key]: !s[f.key] }))}
                    >
                      {showKeys[f.key] ? '🙈' : '👁'}
                    </button>
                  </div>
                </Field>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data API keys */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-title">Data API keys</div>
          <span className="text-tertiary" style={{ fontSize: 11 }}>server-side only — never sent to display app</span>
        </div>
        <div className="section-body space-y-4">
          {dataGroup.map(f => (
            <div key={f.key} className="flex gap-3 items-start">
              <span style={{ fontSize: 20, marginTop: 8 }}>{f.icon}</span>
              <div className="flex-1">
                <Field label={f.label} hint={f.hint}>
                  <div className="flex gap-2">
                    <input
                      className="input font-mono flex-1"
                      type={showKeys[f.key] ? 'text' : 'password'}
                      value={keys[f.key] ?? ''}
                      onChange={e => setKey(f.key, e.target.value)}
                      placeholder="Enter key…"
                    />
                    <button
                      className="btn-ghost shrink-0"
                      style={{ padding: '8px 12px', fontSize: 12 }}
                      onClick={() => setShowKeys(s => ({ ...s, [f.key]: !s[f.key] }))}
                    >
                      {showKeys[f.key] ? '🙈' : '👁'}
                    </button>
                  </div>
                </Field>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save all keys */}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={saveKeys} disabled={isPending} style={{ opacity: isPending ? 0.6 : 1 }}>
          {isPending ? 'Saving…' : 'Save all API keys'}
        </button>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
