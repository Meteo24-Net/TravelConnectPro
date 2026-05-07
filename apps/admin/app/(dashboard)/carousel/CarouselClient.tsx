'use client'

import { useState, useTransition } from 'react'
import { updateCarouselAction, updateGamesAction } from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type SlideType = 'welcome' | 'weather' | 'exchange' | 'wifi' | 'service_request' | 'promo' | 'game' | 'airport' | 'map'

interface SlideItem {
  type:     SlideType
  id:       string
  label:    string
  duration: number   // seconds
  fixed?:   boolean  // can't remove or reorder
}

interface Game {
  id:    string
  label: string
  desc:  string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GAMES: Game[] = [
  { id: 'neon_slots',  label: 'Neon Slots ★',   desc: 'Room-personalised slot machine — server-driven win rates' },
  { id: 'roulette',    label: 'Roulette Wheel',  desc: 'Spinning wheel with random rewards' },
  { id: 'dice',        label: 'Smart Roller',    desc: 'Dice game — 7 or 11 wins' },
  { id: 'memory',      label: 'Memory Matrix',   desc: 'Themed memory card game' },
  { id: 'shell',       label: 'Shell Game',      desc: 'Find the ball under the cup' },
  { id: 'text_wheel',  label: 'Rewards Wheel',   desc: 'Text-based prize wheel' },
  { id: 'spin_win',    label: 'Spin to Win',     desc: 'Interactive — best for room TVs (v.2)' },
]

const TYPE_META: Record<SlideType, { label: string; color: string }> = {
  welcome:         { label: 'welcome',  color: 'var(--tcp-gold)' },
  weather:         { label: 'weather',  color: 'var(--tcp-blue)' },
  exchange:        { label: 'exchange', color: 'var(--tcp-green)' },
  wifi:            { label: 'wi-fi',    color: 'var(--tcp-blue)' },
  service_request: { label: 'service',  color: 'var(--tcp-amber)' },
  promo:           { label: 'promo',    color: 'var(--tcp-gold)' },
  game:            { label: 'game',     color: 'var(--tcp-amber)' },
  airport:         { label: 'flights',  color: 'var(--tcp-blue)' },
  map:             { label: 'map',      color: 'var(--tcp-green)' },
}

const DEFAULT_SEQUENCE: SlideItem[] = [
  { type: 'welcome',         id: 'welcome',         label: 'Welcome',          duration: 8,  fixed: true },
  { type: 'weather',         id: 'weather',         label: 'Weather & Forecast', duration: 8, fixed: true },
  { type: 'exchange',        id: 'exchange',        label: 'Exchange Rates',   duration: 7,  fixed: true },
  { type: 'wifi',            id: 'wifi',            label: 'Guest Wi-Fi',      duration: 6,  fixed: true },
  { type: 'service_request', id: 'service_request', label: 'Service Request',  duration: 7,  fixed: true },
]

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatTotalTime(seq: SlideItem[]) {
  const total = seq.reduce((s, i) => s + i.duration, 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="tag shrink-0"
      style={{
        color,
        background: `${color}1a`,
        borderColor: `${color}44`,
        minWidth: 64,
        justifyContent: 'center',
        fontSize: 10,
      }}
    >
      {label}
    </span>
  )
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-4 right-4 px-4 py-3 rounded-lg text-sm font-medium shadow-lg z-50"
      style={{
        background: ok ? 'rgba(46,204,113,0.15)' : 'rgba(239,68,68,0.15)',
        border:     `1px solid ${ok ? 'rgba(46,204,113,0.4)' : 'rgba(239,68,68,0.4)'}`,
        color:      ok ? 'var(--tcp-green)' : 'var(--tcp-red)',
      }}
    >
      {msg}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  hotelId:      string
  role:         string
  initialSeq:   SlideItem[]
  initialGames: Record<string, boolean>
  airports:     { iata_code: string; airport_name: string }[]
}

export default function CarouselClient({ hotelId, role, initialSeq, initialGames, airports }: Props) {
  const isSuper                       = role === 'super_admin'
  const [seq, setSeq]                 = useState<SlideItem[]>(initialSeq)
  const [games, setGames]             = useState<Record<string, boolean>>(initialGames)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition]  = useTransition()

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Carousel mutations (SuperAdmin only) ───────────────────────────────────

  function moveItem(idx: number, dir: -1 | 1) {
    const next   = [...seq]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    if (next[idx].fixed || next[target].fixed) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setSeq(next)
  }

  function removeItem(idx: number) {
    setSeq(seq.filter((_, i) => i !== idx))
  }

  function updateDuration(idx: number, val: string) {
    const next      = [...seq]
    next[idx]       = { ...next[idx], duration: Math.max(1, parseInt(val) || 0) }
    setSeq(next)
  }

  function addSlide(item: SlideItem) {
    setSeq([...seq, item])
  }

  function setAllDurations(secs: number) {
    setSeq(seq.map(s => s.fixed ? s : { ...s, duration: secs }))
  }

  // ── Game toggles (both roles) ──────────────────────────────────────────────

  function toggleGame(id: string) {
    const next = { ...games, [id]: !games[id] }
    setGames(next)
    startTransition(async () => {
      const result = await updateGamesAction(hotelId, next)
      showToast(result.ok ? 'Games updated' : result.error ?? 'Failed', result.ok)
    })
  }

  // ── Save carousel ──────────────────────────────────────────────────────────

  function saveCarousel() {
    startTransition(async () => {
      const result = await updateCarouselAction(hotelId, seq)
      showToast(result.ok ? 'Carousel saved' : result.error ?? 'Failed', result.ok)
    })
  }

  const enabledGames   = GAMES.filter(g => games[g.id])
  const variableSlides = seq.filter(s => !s.fixed)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: 22 }}>Carousel</h1>
          <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
            {isSuper
              ? 'Configure the TV slide sequence. Games, maps, and flight slides are managed here.'
              : 'Activate games for your screens. Sequence is set by SuperAdmin.'}
          </p>
        </div>
        {isSuper && (
          <button
            className="btn-primary"
            onClick={saveCarousel}
            disabled={isPending}
            style={{ opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? 'Saving…' : 'Save carousel'}
          </button>
        )}
      </div>

      {/* Loop summary */}
      <div className="phase-strip">
        <span style={{ fontSize: 18 }}>↻</span>
        <div className="text-sm text-secondary">
          Total loop:{' '}
          <strong className="text-primary">{formatTotalTime(seq)}</strong>
          {' · '}
          <strong className="text-primary">{seq.length} slides</strong>
          {' · loops automatically'}
        </div>
      </div>

      {/* Game toggles */}
      <div className="section-card" style={{ borderLeft: '3px solid var(--tcp-amber)' }}>
        <div className="section-head">
          <div className="section-title">Active games</div>
          <span className="text-tertiary" style={{ fontSize: 11 }}>
            {enabledGames.length} of {GAMES.length} enabled
          </span>
        </div>
        <div className="section-body grid grid-cols-1 md:grid-cols-2 gap-3">
          {GAMES.map(game => {
            const on = !!games[game.id]
            return (
              <button
                key={game.id}
                onClick={() => toggleGame(game.id)}
                className="flex items-center gap-3 p-3 rounded-lg border text-left transition-all"
                style={{
                  background:   on ? 'rgba(245,158,11,0.06)' : 'var(--bg-input)',
                  borderColor:  on ? 'rgba(245,158,11,0.3)'  : 'var(--border-subtle)',
                  opacity:      on ? 1 : 0.6,
                }}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{game.label}</div>
                  <div className="text-tertiary" style={{ fontSize: 11 }}>{game.desc}</div>
                </div>
                {/* Toggle pill */}
                <div
                  className="shrink-0 rounded-full transition-all"
                  style={{
                    width: 36, height: 20,
                    background: on ? 'var(--tcp-amber)' : 'rgba(255,255,255,0.1)',
                    position: 'relative',
                  }}
                >
                  <div
                    className="absolute rounded-full bg-white transition-all"
                    style={{
                      width: 14, height: 14,
                      top: 3,
                      left: on ? 19 : 3,
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Manager info strip */}
      {!isSuper && (
        <div className="phase-strip">
          <span style={{ fontSize: 18 }}>ℹ</span>
          <div className="text-sm text-secondary">
            Slide sequence and timing are managed by SuperAdmin.
            Use the <strong className="text-primary">Messages</strong> tab to request changes.
          </div>
        </div>
      )}

      {/* Sequence */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-title">Slide sequence</div>
          {isSuper && (
            <div className="flex gap-2">
              <button
                className="btn-ghost"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setAllDurations(60)}
              >
                Set all 60s
              </button>
              <button
                className="btn-ghost"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setAllDurations(90)}
              >
                Set all 90s
              </button>
            </div>
          )}
          {!isSuper && (
            <span className="tag" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-default)', background: 'transparent', fontSize: 10 }}>
              read-only
            </span>
          )}
        </div>
        <div className="section-body space-y-2">
          {seq.map((item, idx) => {
            const meta           = TYPE_META[item.type]
            const isGameDisabled = item.type === 'game' && !games[item.id]
            const isFirst        = idx === 0 || seq[idx - 1]?.fixed
            const isLast         = idx === seq.length - 1

            return (
              <div
                key={`${item.id}-${idx}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors"
                style={{
                  background:  item.fixed ? 'var(--bg-panel-2)' : 'var(--bg-input)',
                  borderColor: item.fixed ? 'var(--border-subtle)' : meta.color + '33',
                  opacity:     isGameDisabled ? 0.45 : 1,
                }}
              >
                {/* Position number */}
                <div
                  className="shrink-0 font-mono text-center rounded"
                  style={{
                    width: 24, fontSize: 11,
                    color: item.fixed ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                  }}
                >
                  {idx + 1}
                </div>

                {/* Type tag */}
                <Tag label={meta.label} color={item.fixed ? 'var(--text-tertiary)' : meta.color} />

                {/* Label */}
                <div className="flex-1 text-sm font-medium">
                  {item.label}
                  {item.fixed && (
                    <span className="ml-2 text-tertiary font-normal" style={{ fontSize: 10 }}>
                      always on
                    </span>
                  )}
                  {isGameDisabled && (
                    <span
                      className="ml-2 tag"
                      style={{ fontSize: 9, color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)', background: 'transparent' }}
                    >
                      game off — skipped
                    </span>
                  )}
                </div>

                {/* Duration */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isSuper && !item.fixed ? (
                    <input
                      type="number"
                      min={1}
                      max={300}
                      className="input font-mono text-center"
                      style={{ width: 64, padding: '5px 8px', fontSize: 13 }}
                      value={item.duration}
                      onChange={e => updateDuration(idx, e.target.value)}
                    />
                  ) : (
                    <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-secondary)', width: 64, textAlign: 'right', display: 'block' }}>
                      {item.duration}
                    </span>
                  )}
                  <span className="text-tertiary" style={{ fontSize: 11 }}>s</span>
                </div>

                {/* Controls — SuperAdmin only, non-fixed slides */}
                {isSuper && !item.fixed && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 13 }}
                      onClick={() => moveItem(idx, -1)}
                      disabled={isFirst}
                    >
                      ↑
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 13 }}
                      onClick={() => moveItem(idx, 1)}
                      disabled={isLast}
                    >
                      ↓
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 13, color: 'var(--tcp-red)' }}
                      onClick={() => removeItem(idx)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add slide panels — SuperAdmin only */}
      {isSuper && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Add game */}
          <div className="section-card" style={{ borderTop: '3px solid var(--tcp-amber)' }}>
            <div className="section-head">
              <div className="section-title" style={{ fontSize: 12 }}>Add game slide</div>
            </div>
            <div className="section-body space-y-1.5">
              {enabledGames.length === 0 ? (
                <div className="text-tertiary text-sm">Enable games above first.</div>
              ) : (
                enabledGames.map(g => (
                  <button
                    key={g.id}
                    className="w-full text-left px-3 py-2 rounded-md text-sm border transition-colors"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
                    onClick={() => addSlide({ type: 'game', id: g.id, label: g.label, duration: 90 })}
                  >
                    + {g.label}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Add airport */}
          <div className="section-card" style={{ borderTop: '3px solid var(--tcp-blue)' }}>
            <div className="section-head">
              <div className="section-title" style={{ fontSize: 12 }}>Add flight slide</div>
            </div>
            <div className="section-body space-y-1.5">
              {airports.length === 0 ? (
                <div className="text-tertiary text-sm">Configure airports first.</div>
              ) : (
                airports.map(a => (
                  <button
                    key={a.iata_code}
                    className="w-full text-left px-3 py-2 rounded-md text-sm border transition-colors"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
                    onClick={() => addSlide({
                      type:     'airport',
                      id:        a.iata_code,
                      label:    `Flights — ${a.iata_code}`,
                      duration:  10,
                    })}
                  >
                    + {a.iata_code} — {a.airport_name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Add map */}
          <div className="section-card" style={{ borderTop: '3px solid var(--tcp-green)' }}>
            <div className="section-head">
              <div className="section-title" style={{ fontSize: 12 }}>Add map slide</div>
            </div>
            <div className="section-body space-y-1.5">
              {variableSlides.some(s => s.type === 'map') ? (
                <div className="text-tertiary text-sm">Map slide already in sequence.</div>
              ) : (
                <button
                  className="w-full text-left px-3 py-2 rounded-md text-sm border transition-colors"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
                  onClick={() => addSlide({ type: 'map', id: 'map', label: 'Area Map', duration: 12 })}
                >
                  + Area Map
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
