'use client'

import { useState, useTransition } from 'react'
import { updateGamesEnabledAction, updateSlotConfigAction } from './actions'

const GAMES = [
  { id: 'roulette',   label: 'Roulette Wheel',  desc: 'Spinning wheel with random rewards.',            type: 'ambient',      emoji: '🎰' },
  { id: 'dice',       label: 'Smart Roller',     desc: 'Dice game — 7 or 11 wins.',                    type: 'ambient',      emoji: '🎲' },
  { id: 'memory',     label: 'Memory Matrix',    desc: 'Themed memory card game.',                      type: 'ambient',      emoji: '🃏' },
  { id: 'shell',      label: 'Shell Game',       desc: 'Find the ball under the cup.',                  type: 'ambient',      emoji: '🥚' },
  { id: 'text_wheel', label: 'Rewards Wheel',    desc: 'Text-based prize wheel.',                       type: 'ambient',      emoji: '🎡' },
  { id: 'spin_win',   label: 'Spin to Win',      desc: 'Interactive — best for room TVs.',              type: 'interactive',  emoji: '🎮', tag: 'v.2' },
  { id: 'neon_slots', label: 'Neon Slots',       desc: 'Room-personalised slot machine. Master-piece.', type: 'interactive',  emoji: '★',  master: true },
]

interface SlotConfig {
  reset_method:           string
  daily_starting_coins:  number
  daily_topup_coins:     number
  midnight_grace_minutes: number
  cost_per_spin:         number
  jackpot_reward_coins:  number
  win_rates:             { jackpot_pct: number; free_spins_pct: number }
  daily_caps:            { jackpot_wins: number }
  fulfillment:           { jackpot_routes_to: string; jackpot_prize: string; jackpot_value_gel: number }
  audio_default_enabled: boolean
  live_stats_mode:       string
}

interface ServiceChannel { channel_id: string; name: string }

interface Props {
  hotelId:         string
  timezone:        string
  gamesEnabled:    Record<string, boolean>
  slotConfig:      SlotConfig
  serviceChannels: ServiceChannel[]
  jackpotToday:    number
  totalSpinsToday: number
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

export default function GamesClient({
  hotelId, timezone, gamesEnabled: g, slotConfig: s,
  serviceChannels, jackpotToday, totalSpinsToday,
}: Props) {
  const [view, setView]               = useState<'roster' | 'slots'>('roster')
  const [games, setGames]             = useState(g)
  const [slot, setSlot]               = useState<SlotConfig>(s)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition]  = useTransition()

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  function toggleGame(id: string) {
    const next = { ...games, [id]: !games[id] }
    setGames(next)
    startTransition(async () => {
      const r = await updateGamesEnabledAction(hotelId, next)
      showToast(r.ok ? 'Games updated' : r.error ?? 'Failed', r.ok)
    })
  }

  function setSlotField<K extends keyof SlotConfig>(key: K, val: SlotConfig[K]) {
    setSlot(s => ({ ...s, [key]: val }))
  }

  function setSlotNested(parent: 'win_rates' | 'daily_caps' | 'fulfillment', key: string, val: unknown) {
    setSlot(s => ({ ...s, [parent]: { ...(s[parent] as Record<string, unknown>), [key]: val } }))
  }

  function saveSlots() {
    startTransition(async () => {
      const r = await updateSlotConfigAction(hotelId, slot as unknown as Record<string, unknown>)
      showToast(r.ok ? 'Neon Slots config saved' : r.error ?? 'Failed', r.ok)
    })
  }

  const jackpotCapRemaining = slot.daily_caps.jackpot_wins - jackpotToday
  const jackpotCapPct       = slot.daily_caps.jackpot_wins > 0
    ? (jackpotToday / slot.daily_caps.jackpot_wins) * 100 : 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>Games config</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          Toggle games, configure prize economics and win rates for Neon Slots.
        </p>
      </div>

      {/* View toggle */}
      <div className="flex">
        {(['roster', 'slots'] as const).map((v, i) => (
          <button key={v} onClick={() => setView(v)}
            className="px-4 py-2 text-xs font-semibold border"
            style={{
              borderRadius: i === 0 ? '6px 0 0 6px' : '0 6px 6px 0',
              borderColor: 'var(--border-default)',
              borderLeft: i === 1 ? 'none' : undefined,
              background: view === v ? 'var(--tcp-blue)' : 'var(--bg-panel)',
              color: view === v ? 'white' : 'var(--text-secondary)',
            }}
          >
            {v === 'roster' ? 'Game roster' : 'Neon Slots ★'}
          </button>
        ))}
      </div>

      {/* ── ROSTER VIEW ────────────────────────────────────────────────────── */}
      {view === 'roster' && (
        <>
          <div className="phase-strip">
            <span style={{ fontSize: 18 }}>◆</span>
            <div className="text-sm text-secondary">
              <strong className="text-primary">Ambient games</strong> auto-play in the lobby (decorative).{' '}
              <strong className="text-primary">Interactive games</strong> respond to the room TV remote — OK button.
              Disabled games are skipped in the carousel automatically.
            </div>
          </div>

          <div className="space-y-2">
            {GAMES.map(game => {
              const on = !!games[game.id]
              return (
                <div
                  key={game.id}
                  className="section-card"
                  style={{ borderLeft: game.master ? '3px solid var(--tcp-gold)' : undefined }}
                >
                  <div className="section-body">
                    <div className="flex items-center gap-4">
                      <span style={{ fontSize: 28 }}>{game.emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{game.label}</span>
                          {game.master && (
                            <span className="tag" style={{ color: 'var(--tcp-gold)', background: 'rgba(197,160,89,0.1)', borderColor: 'rgba(197,160,89,0.3)' }}>★ MASTER</span>
                          )}
                          <span className="tag" style={{
                            color: game.type === 'interactive' ? 'var(--tcp-blue)' : 'var(--text-tertiary)',
                            background: game.type === 'interactive' ? 'rgba(0,159,227,0.12)' : 'transparent',
                            borderColor: game.type === 'interactive' ? 'rgba(0,159,227,0.3)' : 'var(--border-subtle)',
                          }}>
                            {game.type}
                          </span>
                          {game.tag && (
                            <span className="tag" style={{ color: 'var(--tcp-amber)', background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' }}>
                              {game.tag}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-tertiary mt-1">{game.desc}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {game.master && (
                          <button
                            className="btn-ghost"
                            style={{ padding: '5px 12px', fontSize: 12 }}
                            onClick={() => setView('slots')}
                          >
                            Configure →
                          </button>
                        )}
                        <button
                          onClick={() => toggleGame(game.id)}
                          className="rounded-full shrink-0"
                          style={{
                            width: 40, height: 22, border: 'none', cursor: 'pointer',
                            background: on ? 'var(--tcp-blue)' : 'rgba(255,255,255,0.1)',
                            position: 'relative', transition: 'background 0.15s',
                          }}
                        >
                          <div className="absolute rounded-full bg-white" style={{
                            width: 16, height: 16, top: 3, transition: 'left 0.15s',
                            left: on ? 21 : 3,
                          }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── NEON SLOTS VIEW ────────────────────────────────────────────────── */}
      {view === 'slots' && (
        <>
          <div className="phase-strip" style={{ background: 'rgba(197,160,89,0.05)', borderColor: 'rgba(197,160,89,0.2)' }}>
            <span style={{ fontSize: 18, color: 'var(--tcp-gold)' }}>★</span>
            <div className="text-sm text-secondary">
              <strong style={{ color: 'var(--tcp-gold)' }}>Neon Slots</strong> · Room-personalised slot machine. Win rates,
              daily caps, and outcomes are <strong className="text-primary">decided server-side</strong> — clients never
              know the cap state. Auto-refill is off by design — scarcity makes daily play meaningful.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Economy */}
            <div className="section-card">
              <div className="section-head">
                <div className="section-title">Economy</div>
                <span className="text-tertiary" style={{ fontSize: 11 }}>virtual coins — no real money</span>
              </div>
              <div className="section-body space-y-4">
                <Field label="Reset model">
                  <select className="select" value={slot.reset_method}
                    onChange={e => setSlotField('reset_method', e.target.value)}>
                    <option value="stay_based">Stay-based — recommended (multi-day stays accumulate)</option>
                    <option value="daily_midnight">Daily midnight — wipe & re-allocate at 00:00 ({timezone})</option>
                  </select>
                  <div className="text-tertiary mt-1" style={{ fontSize: 11 }}>
                    {slot.reset_method === 'stay_based'
                      ? 'First scan = starting allocation. Each new day adds top-up. Cleared on checkout or 48h inactivity.'
                      : 'Hard reset every night at local midnight, with grace window so late-night players are not wiped mid-spin.'}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Starting coins" hint="One-time on first scan">
                    <input className="input font-mono" type="number" min={10}
                      value={slot.daily_starting_coins}
                      onChange={e => setSlotField('daily_starting_coins', parseInt(e.target.value) || 100)} />
                  </Field>
                  {slot.reset_method === 'stay_based' ? (
                    <Field label="Daily top-up coins" hint="Added each new day on-property">
                      <input className="input font-mono" type="number" min={0}
                        value={slot.daily_topup_coins}
                        onChange={e => setSlotField('daily_topup_coins', parseInt(e.target.value) || 50)} />
                    </Field>
                  ) : (
                    <Field label="Grace period (min)" hint="After midnight reset">
                      <input className="input font-mono" type="number" min={0}
                        value={slot.midnight_grace_minutes}
                        onChange={e => setSlotField('midnight_grace_minutes', parseInt(e.target.value) || 10)} />
                    </Field>
                  )}
                  <Field label="Cost per spin">
                    <input className="input font-mono" type="number" min={1}
                      value={slot.cost_per_spin}
                      onChange={e => setSlotField('cost_per_spin', parseInt(e.target.value) || 10)} />
                  </Field>
                  <Field label="Jackpot coin reward" hint="Bonus coins on jackpot">
                    <input className="input font-mono" type="number" min={0}
                      value={slot.jackpot_reward_coins}
                      onChange={e => setSlotField('jackpot_reward_coins', parseInt(e.target.value) || 1000)} />
                  </Field>
                </div>
              </div>
            </div>

            {/* Win rates */}
            <div className="section-card">
              <div className="section-head">
                <div className="section-title">Win rates · server-driven</div>
              </div>
              <div className="section-body space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Jackpot probability (%)" hint="Per spin">
                    <input className="input font-mono" type="number" min={0} max={20} step={0.1}
                      value={slot.win_rates.jackpot_pct}
                      onChange={e => setSlotNested('win_rates', 'jackpot_pct', parseFloat(e.target.value) || 0)} />
                  </Field>
                  <Field label="Free spins probability (%)" hint="Per spin">
                    <input className="input font-mono" type="number" min={0} max={50} step={0.5}
                      value={slot.win_rates.free_spins_pct}
                      onChange={e => setSlotNested('win_rates', 'free_spins_pct', parseFloat(e.target.value) || 0)} />
                  </Field>
                </div>

                {/* Daily jackpot cap with live bar */}
                <div className="rounded-lg p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)' }}>
                  <Field label="Daily jackpot cap" hint="Once hit, wins fall through to free spins — anti-fraud">
                    <input className="input font-mono" type="number" min={0}
                      value={slot.daily_caps.jackpot_wins}
                      onChange={e => setSlotNested('daily_caps', 'jackpot_wins', parseInt(e.target.value) || 0)}
                      style={{ width: 80 }} />
                  </Field>
                  <div className="flex justify-between text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
                    <span>Today: <strong style={{ color: 'var(--tcp-gold)' }}>{jackpotToday}</strong> jackpots</span>
                    <span>{jackpotCapRemaining < 0 ? 0 : jackpotCapRemaining} remaining</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: 'var(--bg-panel)' }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${Math.min(jackpotCapPct, 100)}%`,
                      background: jackpotCapPct >= 100 ? 'var(--tcp-red)' : 'var(--tcp-gold)',
                    }} />
                  </div>
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {totalSpinsToday} total spins today
                  </div>
                </div>
              </div>
            </div>

            {/* Fulfillment */}
            <div className="section-card lg:col-span-2" style={{ borderLeft: '3px solid var(--tcp-gold)' }}>
              <div className="section-head">
                <div className="section-title">Jackpot fulfillment · routes through Service Requests</div>
                <span className="text-tertiary" style={{ fontSize: 11 }}>triggered automatically on jackpot</span>
              </div>
              <div className="section-body grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Routes to" hint="Which staff team delivers the prize">
                  <select className="select" value={slot.fulfillment.jackpot_routes_to}
                    onChange={e => setSlotNested('fulfillment', 'jackpot_routes_to', e.target.value)}>
                    {serviceChannels.length === 0 ? (
                      <option value="">No channels — configure in Services tab</option>
                    ) : (
                      serviceChannels.map(c => (
                        <option key={c.channel_id} value={c.channel_id}>{c.name}</option>
                      ))
                    )}
                  </select>
                </Field>
                <Field label="Prize description" hint="Shown on guest QR + sent to staff Telegram">
                  <input className="input" value={slot.fulfillment.jackpot_prize}
                    onChange={e => setSlotNested('fulfillment', 'jackpot_prize', e.target.value)}
                    placeholder="Free cocktail at the bar" />
                </Field>
                <Field label="Prize value (GEL)" hint="For analytics + cost tracking">
                  <input className="input font-mono" type="number" min={0}
                    value={slot.fulfillment.jackpot_value_gel}
                    onChange={e => setSlotNested('fulfillment', 'jackpot_value_gel', parseInt(e.target.value) || 0)} />
                </Field>
                <div className="md:col-span-3 rounded-lg p-3" style={{ background: 'rgba(46,204,113,0.04)', border: '1px solid rgba(46,204,113,0.2)' }}>
                  <div className="text-sm font-semibold mb-1" style={{ color: 'var(--tcp-green)' }}>How fulfillment works</div>
                  <div className="text-xs text-secondary leading-relaxed">
                    Jackpot trigger → Edge Function generates verification QR → service request inserted with{' '}
                    <strong className="text-primary">"{slot.fulfillment.jackpot_prize || 'prize'}"</strong> for the room →
                    routed to <strong className="text-primary">
                      {serviceChannels.find(c => c.channel_id === slot.fulfillment.jackpot_routes_to)?.name ?? 'selected channel'}
                    </strong> via Telegram → staff delivers prize and scans QR to complete. Fully integrated with the Service Requests pipeline.
                  </div>
                </div>
              </div>
            </div>

            {/* Audio + stats */}
            <div className="section-card">
              <div className="section-head"><div className="section-title">Audio defaults</div></div>
              <div className="section-body space-y-3">
                <button
                  onClick={() => setSlotField('audio_default_enabled', !slot.audio_default_enabled)}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg w-full text-left"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)' }}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">Audio enabled by default</div>
                    <div className="text-xs text-tertiary mt-1">Off recommended for room TVs. On for lobby kiosks.</div>
                  </div>
                  <div className="rounded-full shrink-0" style={{
                    width: 40, height: 22,
                    background: slot.audio_default_enabled ? 'var(--tcp-blue)' : 'rgba(255,255,255,0.1)',
                    position: 'relative',
                  }}>
                    <div className="absolute rounded-full bg-white" style={{
                      width: 16, height: 16, top: 3, transition: 'left 0.15s',
                      left: slot.audio_default_enabled ? 21 : 3,
                    }} />
                  </div>
                </button>
                <div className="phase-strip" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                  <span>🔇</span>
                  <div className="text-xs text-secondary">Guests can always tap to unmute. Default off keeps the in-room experience polite.</div>
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-head"><div className="section-title">Live stats display</div></div>
              <div className="section-body space-y-3">
                <Field label="Stats mode">
                  <select className="select" value={slot.live_stats_mode}
                    onChange={e => setSlotField('live_stats_mode', e.target.value)}>
                    <option value="real">Real — actual property activity</option>
                    <option value="off">Off — hide live stats</option>
                  </select>
                </Field>
                <div className="phase-strip" style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.2)' }}>
                  <span>⚠</span>
                  <div className="text-xs text-secondary">Never use fake stats. Real numbers (actual spins, distinct rooms) build trust. Guests notice fake counts.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" onClick={saveSlots} disabled={isPending} style={{ opacity: isPending ? 0.6 : 1 }}>
              {isPending ? 'Saving…' : 'Save Neon Slots config'}
            </button>
          </div>
        </>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
