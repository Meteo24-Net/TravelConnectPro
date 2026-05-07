'use client'

import { useState, useTransition } from 'react'
import { updateBrandingAction }     from './actions'

// ─── Font pairings ────────────────────────────────────────────────────────────

const FONT_PAIRINGS = [
  { id: 'classic',   label: 'Classic',   heading: 'Playfair Display', body: 'Inter',          desc: 'Elegant serif + clean sans — default TCP' },
  { id: 'modern',    label: 'Modern',    heading: 'Manrope',          body: 'Inter',          desc: 'Contemporary geometric — high readability' },
  { id: 'editorial', label: 'Editorial', heading: 'Cormorant Garamond', body: 'Nunito Sans', desc: 'Luxury editorial — boutique properties' },
  { id: 'tech',      label: 'Tech',      heading: 'Space Grotesk',    body: 'Space Mono',     desc: 'Modern tech — business / airport hotels' },
]

const COLOR_LABELS: Record<string, { label: string; desc: string }> = {
  primary:     { label: 'Primary brand',   desc: 'Main accent — buttons, highlights' },
  accent_gold: { label: 'Gold accent',     desc: 'Secondary accent — luxury touches' },
  accent_blue: { label: 'TCP blue',        desc: 'Interactive elements — default #009FE3' },
  background:  { label: 'Display background', desc: 'TV screen background color' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThemeConfig {
  logo: { url: string | null; height: number; filter: 'none' | 'invert' | 'brightness' }
  colors: { primary: string; accent_gold: string; accent_blue: string; background: string }
  fonts: { heading: string; body: string; pairing: string }
}

interface Props {
  hotelId:   string
  hotelName: string
  theme:     ThemeConfig
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

// ─── Live preview ─────────────────────────────────────────────────────────────

function DisplayPreview({ theme, hotelName }: { theme: ThemeConfig; hotelName: string }) {
  const fontLink = theme.fonts.pairing === 'editorial'
    ? 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Nunito+Sans:wght@400;600&display=swap'
    : theme.fonts.pairing === 'tech'
    ? 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600&family=Space+Mono&display=swap'
    : theme.fonts.pairing === 'modern'
    ? null  // Manrope already loaded
    : null  // Playfair + Inter already loaded

  return (
    <div className="section-card overflow-hidden">
      <div className="section-head">
        <div className="section-title">Live preview</div>
        <span className="text-tertiary" style={{ fontSize: 11 }}>lobby TV — 16:9</span>
      </div>
      <div style={{ background: 'var(--bg-panel-2)', padding: 16 }}>
        {fontLink && <link rel="stylesheet" href={fontLink} />}
        {/* 16:9 preview frame */}
        <div
          className="w-full rounded-lg overflow-hidden"
          style={{
            aspectRatio: '16/9',
            background: theme.colors.background,
            fontFamily: `'${theme.fonts.body}', sans-serif`,
            position: 'relative',
          }}
        >
          {/* Top bar */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-6"
            style={{ height: '12%', background: 'rgba(0,0,0,0.4)', borderBottom: `2px solid ${theme.colors.primary}` }}
          >
            {theme.logo.url ? (
              <img
                src={theme.logo.url}
                alt="Logo"
                style={{
                  height: `${theme.logo.height * 0.4}px`,
                  filter: theme.logo.filter === 'invert' ? 'brightness(0) invert(1)'
                        : theme.logo.filter === 'brightness' ? 'brightness(1.5)' : 'none',
                }}
              />
            ) : (
              <div style={{ fontFamily: `'${theme.fonts.heading}', serif`, color: theme.colors.accent_gold, fontSize: '2.5cqi', fontWeight: 700 }}>
                {hotelName}
              </div>
            )}
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.5cqi', fontFamily: 'monospace' }}>
              {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Main content area */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: '14%' }}>
            <div className="text-center space-y-2">
              <div style={{
                fontFamily: `'${theme.fonts.heading}', serif`,
                color: 'white',
                fontSize: '4cqi',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}>
                Welcome
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.8cqi' }}>
                We hope you enjoy your stay
              </div>
              <div
                className="inline-block px-4 py-1 rounded-full mt-3"
                style={{ background: theme.colors.primary, color: 'white', fontSize: '1.5cqi', fontWeight: 600 }}
              >
                Scan for services
              </div>
            </div>
          </div>

          {/* Bottom accent bar */}
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{ height: '3px', background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.accent_gold})` }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BrandingClient({ hotelId, hotelName, theme: initialTheme }: Props) {
  const [theme, setTheme]           = useState<ThemeConfig>(initialTheme)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function setColor(key: string, value: string) {
    setTheme(t => ({ ...t, colors: { ...t.colors, [key]: value } }))
  }

  function setLogo(key: string, value: string | number) {
    setTheme(t => ({ ...t, logo: { ...t.logo, [key]: value } }))
  }

  function setFontPairing(id: string) {
    const pairing = FONT_PAIRINGS.find(p => p.id === id)
    if (!pairing) return
    setTheme(t => ({ ...t, fonts: { pairing: id, heading: pairing.heading, body: pairing.body } }))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateBrandingAction(hotelId, theme)
      showToast(result.ok ? 'Branding saved — all screens will pick up changes within 5 min' : result.error ?? 'Failed', result.ok)
    })
  }

  const currentPairing = FONT_PAIRINGS.find(p => p.id === theme.fonts.pairing) ?? FONT_PAIRINGS[0]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: 22 }}>Branding</h1>
          <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
            Logo, colors, and fonts — applied across all displays for this property. SuperAdmin only.
          </p>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={isPending} style={{ opacity: isPending ? 0.6 : 1 }}>
          {isPending ? 'Saving…' : 'Save branding'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column — controls */}
        <div className="space-y-5">

          {/* Logo */}
          <div className="section-card">
            <div className="section-head">
              <div className="section-title">Logo</div>
            </div>
            <div className="section-body space-y-4">
              <div>
                <label className="block text-xs text-secondary mb-1.5 font-medium">
                  Logo URL
                  <span className="ml-2 text-tertiary font-normal">— file upload coming in v.2</span>
                </label>
                <input
                  className="input font-mono"
                  placeholder="https://example.com/logo.png"
                  value={theme.logo.url ?? ''}
                  onChange={e => setLogo('url', e.target.value || null as unknown as string)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-secondary mb-1.5 font-medium">Height (px)</label>
                  <input
                    className="input font-mono"
                    type="number"
                    min={20}
                    max={200}
                    value={theme.logo.height}
                    onChange={e => setLogo('height', parseInt(e.target.value) || 48)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary mb-1.5 font-medium">Filter</label>
                  <select
                    className="select"
                    value={theme.logo.filter}
                    onChange={e => setLogo('filter', e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="invert">Invert (dark bg)</option>
                    <option value="brightness">Brightness boost</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="section-card">
            <div className="section-head">
              <div className="section-title">Color tokens</div>
              <button
                className="btn-ghost"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setTheme(t => ({
                  ...t,
                  colors: { primary: '#009FE3', accent_gold: '#c9a84c', accent_blue: '#009FE3', background: '#0f0f1e' }
                }))}
              >
                Reset to TCP defaults
              </button>
            </div>
            <div className="section-body space-y-3">
              {(Object.entries(theme.colors) as [string, string][]).map(([key, val]) => {
                const meta = COLOR_LABELS[key] ?? { label: key, desc: '' }
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
                  >
                    {/* Color swatch + native picker */}
                    <label className="shrink-0 cursor-pointer relative" style={{ width: 36, height: 36 }}>
                      <div
                        className="w-full h-full rounded-lg border-2"
                        style={{ background: val, borderColor: 'rgba(255,255,255,0.2)' }}
                      />
                      <input
                        type="color"
                        value={val}
                        onChange={e => setColor(key, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{meta.label}</div>
                      <div className="text-tertiary" style={{ fontSize: 11 }}>{meta.desc}</div>
                    </div>
                    <input
                      className="input font-mono"
                      style={{ width: 96 }}
                      value={val}
                      maxLength={7}
                      onChange={e => {
                        const v = e.target.value
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor(key, v)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Font pairing */}
          <div className="section-card">
            <div className="section-head">
              <div className="section-title">Font pairing</div>
              <span className="text-tertiary" style={{ fontSize: 11 }}>display app only — admin uses Manrope always</span>
            </div>
            <div className="section-body space-y-2">
              {FONT_PAIRINGS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setFontPairing(p.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all"
                  style={{
                    background:  theme.fonts.pairing === p.id ? 'rgba(0,159,227,0.08)' : 'var(--bg-input)',
                    borderColor: theme.fonts.pairing === p.id ? 'rgba(0,159,227,0.3)' : 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="shrink-0 rounded-full"
                    style={{
                      width: 16, height: 16,
                      background: theme.fonts.pairing === p.id ? 'var(--tcp-blue)' : 'transparent',
                      border: `2px solid ${theme.fonts.pairing === p.id ? 'var(--tcp-blue)' : 'var(--border-default)'}`,
                    }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-tertiary" style={{ fontSize: 11 }}>
                      {p.heading} + {p.body} · {p.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — preview */}
        <div className="space-y-5">
          <DisplayPreview theme={theme} hotelName={hotelName} />

          {/* Token summary */}
          <div className="section-card">
            <div className="section-head">
              <div className="section-title">display-config output</div>
              <span className="text-tertiary" style={{ fontSize: 11 }}>what TVs receive</span>
            </div>
            <div className="section-body">
              <pre
                className="text-xs font-mono overflow-auto rounded-lg p-3"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.6 }}
              >
{JSON.stringify({
  branding: {
    logo_url:    theme.logo.url,
    colors:      theme.colors,
    fonts:       { heading: theme.fonts.heading, body: theme.fonts.body },
  }
}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
