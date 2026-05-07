'use client'

import { useState, useTransition } from 'react'
import { updateWelcomeAction }     from './actions'

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ka: 'Georgian (ქართული)', ru: 'Russian (Русский)', tr: 'Turkish (Türkçe)',
  de: 'German', fr: 'French', ar: 'Arabic', zh: 'Chinese', es: 'Spanish',
}

const TIME_OF_DAY_EMOJI: Record<string, string> = {
  morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙',
}

interface Template {
  language_code: string
  time_of_day:   string
  greeting:      string
  subtext:       string
}

interface WelcomeConfig {
  timing_sec:      number
  highlight_offer: string
  greetings:       Record<string, string>
}

interface Props {
  hotelId:           string
  hotelName:         string
  supportedLanguages: string[]
  welcome:           WelcomeConfig
  templates:         Template[]
  primaryColor:      string
  accentGold:        string
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

export default function WelcomeClient({
  hotelId, hotelName, supportedLanguages, welcome: initial, templates, primaryColor, accentGold
}: Props) {
  const [welcome, setWelcome]         = useState<WelcomeConfig>(initial)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition]  = useTransition()

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  function setGreeting(lang: string, val: string) {
    setWelcome(w => ({ ...w, greetings: { ...w.greetings, [lang]: val } }))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateWelcomeAction(hotelId, welcome)
      showToast(result.ok ? 'Welcome config saved' : result.error ?? 'Failed', result.ok)
    })
  }

  // Group templates by time_of_day for the reference table
  const timeGroups = ['morning', 'afternoon', 'evening', 'night']
  const templatesByTime = timeGroups.reduce((acc, t) => {
    acc[t] = templates.filter(tmpl => tmpl.time_of_day === t)
    return acc
  }, {} as Record<string, Template[]>)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: 22 }}>Welcome screen</h1>
          <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
            Branded splash on TV power-on. Lobby screens show it on reboot; room TVs show it every time the guest turns on the TV.
          </p>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={isPending} style={{ opacity: isPending ? 0.6 : 1 }}>
          {isPending ? 'Saving…' : 'Save welcome config'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — controls */}
        <div className="space-y-5">

          {/* Content */}
          <div className="section-card">
            <div className="section-head">
              <div className="section-title">Welcome content</div>
            </div>
            <div className="section-body space-y-4">
              <div>
                <label className="block text-xs text-secondary mb-1.5 font-medium">
                  Display duration
                  <span className="ml-1 text-tertiary font-normal">— seconds before fading to carousel</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={3} max={60} step={1}
                    value={welcome.timing_sec}
                    onChange={e => setWelcome(w => ({ ...w, timing_sec: parseInt(e.target.value) }))}
                    className="flex-1"
                  />
                  <span className="font-mono text-primary font-bold" style={{ width: 40, textAlign: 'right' }}>
                    {welcome.timing_sec}s
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-secondary mb-1.5 font-medium">
                  Today's highlight offer
                  <span className="ml-1 text-tertiary font-normal">— shown at bottom of welcome splash</span>
                </label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="e.g. 15% off Spa treatments this weekend · Book at reception"
                  value={welcome.highlight_offer}
                  onChange={e => setWelcome(w => ({ ...w, highlight_offer: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Per-language greeting overrides */}
          <div className="section-card">
            <div className="section-head">
              <div className="section-title">Greeting overrides</div>
              <span className="text-tertiary" style={{ fontSize: 11 }}>
                blank = auto (Good morning / afternoon / evening)
              </span>
            </div>
            <div className="section-body space-y-3">
              <div className="phase-strip">
                <span style={{ fontSize: 16 }}>ℹ</span>
                <div className="text-sm text-secondary">
                  Leave blank to use the global template library. Override only when you want a custom greeting for this property.
                </div>
              </div>
              {supportedLanguages.map(lang => (
                <div key={lang}>
                  <label className="block text-xs text-secondary mb-1.5 font-medium">
                    {LANGUAGE_NAMES[lang] ?? lang.toUpperCase()}
                  </label>
                  <input
                    className="input"
                    placeholder={`e.g. Welcome to ${hotelName}`}
                    value={welcome.greetings[lang] ?? ''}
                    onChange={e => setGreeting(lang, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — preview + template library */}
        <div className="space-y-5">
          {/* Live preview */}
          <div className="section-card overflow-hidden">
            <div className="section-head">
              <div className="section-title">Live preview</div>
              <span className="text-tertiary" style={{ fontSize: 11 }}>lobby TV</span>
            </div>
            <div style={{ background: 'var(--bg-panel-2)', padding: 16 }}>
              <div
                className="w-full rounded-lg overflow-hidden flex flex-col justify-between"
                style={{
                  aspectRatio: '16/9',
                  background: 'linear-gradient(135deg, #14141a 0%, #0a0a0d 100%)',
                  padding: '6% 8%',
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                {/* Hotel name */}
                <div style={{ color: accentGold, fontSize: '3cqi', fontWeight: 600, letterSpacing: '0.06em' }}>
                  {hotelName}
                </div>

                {/* Greeting */}
                <div className="text-center">
                  <div style={{ color: 'white', fontSize: '5cqi', fontWeight: 600, lineHeight: 1.2 }}>
                    {welcome.greetings['en'] || 'Good evening'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '2cqi', marginTop: '1.5cqi', fontFamily: 'Inter, sans-serif' }}>
                    We hope you enjoy your stay
                  </div>
                </div>

                {/* Highlight offer */}
                <div
                  className="rounded-lg text-center"
                  style={{
                    background: `${primaryColor}22`,
                    border: `1px solid ${primaryColor}44`,
                    padding: '2cqi 3cqi',
                  }}
                >
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.2cqi', fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', fontWeight: 600 }}>
                    TODAY'S HIGHLIGHT
                  </div>
                  <div style={{ color: accentGold, fontSize: '1.8cqi', fontFamily: 'Inter, sans-serif', marginTop: '0.5cqi' }}>
                    {welcome.highlight_offer || 'No offer set — add one to the left'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Template library reference */}
          {templates.length > 0 && (
            <div className="section-card">
              <div className="section-head">
                <div className="section-title">Global template library</div>
                <span className="text-tertiary" style={{ fontSize: 11 }}>SuperAdmin-managed · read-only here</span>
              </div>
              <div className="section-body space-y-4">
                {timeGroups.map(time => {
                  const group = templatesByTime[time]
                  if (!group?.length) return null
                  return (
                    <div key={time}>
                      <div className="flex items-center gap-2 mb-2">
                        <span>{TIME_OF_DAY_EMOJI[time]}</span>
                        <span className="text-xs font-semibold text-secondary uppercase tracking-wider">{time}</span>
                      </div>
                      <div className="space-y-1.5">
                        {group.map((tmpl, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 px-3 py-2 rounded-lg"
                            style={{ background: 'var(--bg-input)' }}
                          >
                            <span
                              className="shrink-0 font-mono text-xs font-bold rounded px-1.5 py-0.5"
                              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-tertiary)' }}
                            >
                              {tmpl.language_code.toUpperCase()}
                            </span>
                            <div>
                              <div className="text-sm font-medium">{tmpl.greeting}</div>
                              {tmpl.subtext && (
                                <div className="text-xs text-tertiary mt-0.5">{tmpl.subtext}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
