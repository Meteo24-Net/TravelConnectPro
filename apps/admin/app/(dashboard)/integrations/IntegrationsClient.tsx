'use client'

import { useState, useTransition } from 'react'
import { saveIntegrationConfigAction, triggerRefreshAction } from './actions'

interface Props {
  hotelId: string
  initialConfig: any
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

export default function IntegrationsClient({ hotelId, initialConfig }: Props) {
  const [config, setConfig]       = useState(initialConfig)
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  function updateConfig(path: string[], value: any) {
    setConfig((prev: any) => {
      const newCfg = JSON.parse(JSON.stringify(prev))
      let current = newCfg
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {}
        current = current[path[i]]
      }
      current[path[path.length - 1]] = value
      return newCfg
    })
  }

  function save() {
    startTransition(async () => {
      const r = await saveIntegrationConfigAction(hotelId, config)
      showToast(r.ok ? 'Configuration saved successfully' : r.error ?? 'Failed', r.ok)
    })
  }

  const currency = config.currency || {}
  const oxrKey = currency.providers?.oxr?.api_key || ''

  return (
    <div className="space-y-6 max-w-4xl pb-20">
      <div>
        <h1 className="font-bold" style={{ fontSize: 24, letterSpacing: '-0.02em' }}>Integrations</h1>
        <p className="text-secondary" style={{ fontSize: 14, marginTop: 4 }}>
          Manage your third-party API providers, credentials, and business rules.
        </p>
      </div>

      {/* Global Currency Provider */}
      <div className="section-card" style={{ borderLeft: '4px solid var(--tcp-amber)' }}>
        <div className="section-head flex justify-between items-center pb-4 border-b border-subtle">
          <div>
            <div className="section-title text-lg">Currency Provider (Global)</div>
            <div className="text-tertiary text-xs mt-1">Powers live FX rates for display screens.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary font-medium mr-2">Enabled</span>
            <button 
              onClick={() => updateConfig(['currency', 'enabled'], !currency.enabled)}
              className={`w-10 h-5 rounded-full relative transition-colors ${currency.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${currency.enabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="section-body pt-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Field label="API Provider" hint="Determines the source of mid-market rates.">
              <select 
                className="select w-full" 
                value={currency.source || 'oxr'}
                onChange={(e) => updateConfig(['currency', 'source'], e.target.value)}
              >
                <option value="oxr">Open Exchange Rates (OXR)</option>
                <option value="nbg">NBG (National Bank of Georgia)</option>
              </select>
            </Field>

            <Field label="OXR App ID (API Key)" hint="Required for OXR provider.">
              <input 
                className="input font-mono" 
                type="password" 
                value={oxrKey}
                onChange={(e) => updateConfig(['currency', 'providers', 'oxr', 'api_key'], e.target.value)}
                placeholder="Enter App ID..."
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <Field label="Base Currency" hint="Property's home currency.">
              <input 
                className="input uppercase font-bold" 
                maxLength={3}
                value={currency.base_currency || 'GEL'}
                onChange={(e) => updateConfig(['currency', 'base_currency'], e.target.value.toUpperCase())}
              />
            </Field>

            <Field label="Spread Percentage (%)" hint="Applied to buy/sell rates. 0.015 = 1.5%">
              <input 
                className="input font-mono" 
                type="number" 
                step="0.001"
                value={currency.spread_pct || 0.015}
                onChange={(e) => updateConfig(['currency', 'spread_pct'], parseFloat(e.target.value))}
              />
            </Field>

            <Field label="Refresh Interval (Hours)" hint="How often rates are cached.">
              <input 
                className="input font-mono" 
                type="number"
                value={currency.refresh_interval_hours || 6}
                onChange={(e) => updateConfig(['currency', 'refresh_interval_hours'], parseInt(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Display Currencies (Comma separated)" hint="Currencies to show on the ticker.">
            <input 
              className="input uppercase font-mono tracking-widest" 
              value={(currency.display_codes || []).join(', ')}
              onChange={(e) => updateConfig(['currency', 'display_codes'], e.target.value.split(',').map(s => s.trim().toUpperCase()))}
              placeholder="USD, EUR, TRY..."
            />
          </Field>
        </div>
      </div>

      {/* Flight Provider */}
      <div className="section-card" style={{ borderLeft: '4px solid var(--tcp-blue)' }}>
        <div className="section-head flex justify-between items-center pb-4 border-b border-subtle">
          <div>
            <div className="section-title text-lg">Flight Provider (AirLabs)</div>
            <div className="text-tertiary text-xs mt-1">Real-time Arrivals & Departures for guests.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary font-medium mr-2">Enabled</span>
            <button 
              onClick={() => updateConfig(['flights', 'enabled'], !config.flights?.enabled)}
              className={`w-10 h-5 rounded-full relative transition-colors ${config.flights?.enabled ? 'bg-blue-500' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.flights?.enabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="section-body pt-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Field label="IATA Airport Code" hint="The 3-letter code for the nearest airport.">
              <input 
                className="input uppercase font-bold tracking-widest" 
                maxLength={3}
                value={config.flights?.iata_code || 'BUS'}
                onChange={(e) => updateConfig(['flights', 'iata_code'], e.target.value.toUpperCase())}
              />
            </Field>

            <Field label="AirLabs API Key" hint="Required for live flight tracking.">
              <input 
                className="input font-mono" 
                type="password" 
                value={config.flights?.providers?.airlabs?.api_key || ''}
                onChange={(e) => updateConfig(['flights', 'providers', 'airlabs', 'api_key'], e.target.value)}
                placeholder="Enter API Key..."
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Field label="Airport Name (Display)" hint="Friendly name shown on screen.">
              <input 
                className="input" 
                value={config.flights?.airport_name || 'Airport'}
                onChange={(e) => updateConfig(['flights', 'airport_name'], e.target.value)}
              />
            </Field>

            <Field label="Drive Time (Minutes)" hint="Estimated time from hotel to airport.">
              <input 
                className="input font-mono" 
                type="number"
                value={config.flights?.drive_time_minutes || 15}
                onChange={(e) => updateConfig(['flights', 'drive_time_minutes'], parseInt(e.target.value))}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Map Configuration */}
      <div className="section-card" style={{ borderLeft: '4px solid var(--tcp-blue)' }}>
        <div className="section-head pb-4 border-b border-subtle">
          <div className="section-title text-lg">Map Configuration</div>
          <div className="text-tertiary text-xs mt-1">Visual settings for property maps.</div>
        </div>
        <div className="section-body pt-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Field label="Primary Provider">
              <select className="select w-full" value={config.maps?.provider || 'maplibre'}
                onChange={e => updateConfig(['maps', 'provider'], e.target.value)}>
                <option value="maplibre">MapLibre (OSM)</option>
                <option value="mapbox">Mapbox</option>
              </select>
            </Field>
            <Field label="Default Zoom">
              <input className="input font-mono" type="number" min={8} max={20}
                value={config.maps?.default_zoom || 13}
                onChange={e => updateConfig(['maps', 'default_zoom'], parseInt(e.target.value))} />
            </Field>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 gap-3">
        <button 
          className="btn-ghost px-6 py-3 rounded-xl font-medium border border-subtle" 
          onClick={async () => {
            startTransition(async () => {
              const r = await triggerRefreshAction(hotelId)
              showToast(r.ok ? 'Manual refresh triggered' : r.error ?? 'Failed', r.ok)
            })
          }} 
          disabled={isPending}
        >
          {isPending ? 'Processing...' : '🔄 Trigger Manual Refresh'}
        </button>
        <button 
          className="btn-primary px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20" 
          onClick={save} 
          disabled={isPending}
        >
          {isPending ? 'Syncing...' : 'Save All Changes'}
        </button>
      </div>

      {/* Diagnostics Section */}
      <div className="mt-12 p-6 rounded-2xl bg-black/40 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <h2 className="text-sm font-bold tracking-widest uppercase text-secondary">System Health & Diagnostics</h2>
        </div>
        <div className="grid grid-cols-4 gap-8">
          <div>
            <div className="text-[10px] text-tertiary uppercase font-bold mb-1">Last Data Fetch</div>
            <div className="text-sm font-mono text-primary">{initialConfig.cacheStatus?.last_success_at ? new Date(initialConfig.cacheStatus.last_success_at).toLocaleString() : 'Never'}</div>
          </div>
          <div>
            <div className="text-[10px] text-tertiary uppercase font-bold mb-1">Active Source</div>
            <div className="text-sm text-primary">{initialConfig.cacheStatus?.source || 'N/A'}</div>
          </div>
          <div>
            <div className="text-[10px] text-tertiary uppercase font-bold mb-1">Source Date</div>
            <div className="text-sm text-primary">{initialConfig.cacheStatus?.date || 'N/A'}</div>
          </div>
          <div>
            <div className="text-[10px] text-tertiary uppercase font-bold mb-1">Cache Status</div>
            <div className="tag bg-green-500/10 text-green-500 border-green-500/20 px-2 py-0.5 rounded text-[10px] font-bold">HEALTHY</div>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
