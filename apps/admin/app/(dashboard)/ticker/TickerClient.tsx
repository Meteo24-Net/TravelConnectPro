'use client'

import { useState, useTransition } from 'react'
import { updateTickerListAction, updateSportsAction } from './actions'

const SPORTS = [
  { id: 'football',    label: 'Football ⚽',  desc: 'Premier League, Champions League, La Liga' },
  { id: 'basketball',  label: 'Basketball 🏀', desc: 'NBA, EuroLeague' },
  { id: 'tennis',      label: 'Tennis 🎾',     desc: 'ATP / WTA — Grand Slams + Masters' },
  { id: 'formula1',    label: 'Formula 1 🏎',  desc: 'Race results and standings' },
  { id: 'rugby',       label: 'Rugby 🏉',      desc: 'Six Nations, World Cup' },
  { id: 'cricket',     label: 'Cricket 🏏',    desc: 'Test matches and T20' },
  { id: 'volleyball',  label: 'Volleyball 🏐', desc: 'FIVB World League' },
  { id: 'mma',         label: 'MMA 🥊',        desc: 'UFC events' },
]

const LIST_CONFIG = [
  { key: 'announcements' as const, title: 'Announcements', color: 'var(--tcp-red)',   placeholder: 'Pool closing at 22:00 tonight' },
  { key: 'events'        as const, title: 'Local events',  color: 'var(--tcp-green)', placeholder: 'Batumi Jazz Festival — June 12, Batumi Arena' },
  { key: 'offers'        as const, title: 'Hotel offers',  color: 'var(--tcp-gold)',  placeholder: '15% off Spa treatments this weekend' },
]

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

interface TickerListProps {
  title:       string
  color:       string
  placeholder: string
  items:       string[]
  onChange:    (items: string[]) => void
  onSave:      () => void
  saving:      boolean
}

function TickerList({ title, color, placeholder, items, onChange, onSave, saving }: TickerListProps) {
  function update(idx: number, val: string) {
    const next = [...items]; next[idx] = val; onChange(next)
  }
  function remove(idx: number) { onChange(items.filter((_, i) => i !== idx)) }
  function add() { onChange([...items, '']) }

  return (
    <div className="section-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="section-head">
        <div className="section-title" style={{ fontSize: 13 }}>{title}</div>
        <div className="flex items-center gap-2">
          <span className="text-tertiary" style={{ fontSize: 11 }}>{items.length} lines</span>
          <button
            className="btn-primary"
            style={{ padding: '4px 10px', fontSize: 11, opacity: saving ? 0.6 : 1 }}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </div>
      <div className="section-body space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-1.5">
            <textarea
              className="textarea"
              rows={2}
              style={{ resize: 'none', flex: 1 }}
              value={item}
              placeholder={placeholder}
              onChange={e => update(idx, e.target.value)}
            />
            <button
              className="btn-ghost shrink-0"
              style={{ padding: '4px 8px', fontSize: 16, color: 'var(--tcp-red)', alignSelf: 'flex-start' }}
              onClick={() => remove(idx)}
            >×</button>
          </div>
        ))}
        <button
          className="btn-ghost w-full text-center"
          style={{ fontSize: 12, borderStyle: 'dashed' }}
          onClick={add}
        >
          + Add line
        </button>
      </div>
    </div>
  )
}

interface Props {
  hotelId:       string
  role:          string
  announcements: string[]
  events:        string[]
  offers:        string[]
  sports:        Record<string, boolean>
}

export default function TickerClient({ hotelId, role, announcements: a, events: e, offers: o, sports: s }: Props) {
  const isSuper = role === 'super_admin'

  const [announcements, setAnnouncements] = useState<string[]>(a)
  const [events,        setEvents]        = useState<string[]>(e)
  const [offers,        setOffers]        = useState<string[]>(o)
  const [sports,        setSports]        = useState<Record<string, boolean>>(s)
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null)
  const [saving, startTransition]         = useTransition()

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function saveList(key: 'announcements' | 'events' | 'offers', items: string[]) {
    startTransition(async () => {
      const result = await updateTickerListAction(hotelId, key, items)
      showToast(result.ok ? `${key} saved` : result.error ?? 'Failed', result.ok)
    })
  }

  function toggleSport(id: string) {
    const next = { ...sports, [id]: !sports[id] }
    setSports(next)
    startTransition(async () => {
      const result = await updateSportsAction(hotelId, next)
      showToast(result.ok ? 'Sports updated' : result.error ?? 'Failed', result.ok)
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>Ticker</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          {isSuper
            ? 'Scrolling bar at the bottom of all screens. Cycles through announcements, events, offers, and live sports.'
            : 'Manage the scrolling text shown on your screens. Sports feed is set by SuperAdmin.'}
        </p>
      </div>

      {/* Three lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {LIST_CONFIG.map(cfg => {
          const items    = cfg.key === 'announcements' ? announcements : cfg.key === 'events' ? events : offers
          const setItems = cfg.key === 'announcements' ? setAnnouncements : cfg.key === 'events' ? setEvents : setOffers
          return (
            <TickerList
              key={cfg.key}
              title={cfg.title}
              color={cfg.color}
              placeholder={cfg.placeholder}
              items={items}
              onChange={setItems}
              onSave={() => saveList(cfg.key, items)}
              saving={saving}
            />
          )
        })}
      </div>

      {/* Sports — SuperAdmin editable, Manager read-only */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-title">Live sports feed</div>
          <span
            className="tag"
            style={{
              color:       isSuper ? 'var(--tcp-blue)' : 'var(--text-tertiary)',
              borderColor: isSuper ? 'rgba(0,159,227,0.3)' : 'var(--border-subtle)',
              background:  'transparent',
              fontSize: 10,
            }}
          >
            {isSuper ? 'SuperAdmin · via API-Sports' : 'Set by SuperAdmin'}
          </span>
        </div>
        <div className="section-body">
          {isSuper ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {SPORTS.map(sport => {
                  const on = !!sports[sport.id]
                  return (
                    <button
                      key={sport.id}
                      onClick={() => toggleSport(sport.id)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all"
                      style={{
                        background:  on ? 'rgba(0,159,227,0.06)' : 'var(--bg-input)',
                        borderColor: on ? 'rgba(0,159,227,0.3)'  : 'var(--border-subtle)',
                        opacity:     on ? 1 : 0.6,
                      }}
                    >
                      <span className="text-sm font-medium">{sport.label}</span>
                      <div
                        className="shrink-0 rounded-full"
                        style={{
                          width: 28, height: 16,
                          background: on ? 'var(--tcp-blue)' : 'rgba(255,255,255,0.1)',
                          position: 'relative',
                        }}
                      >
                        <div
                          className="absolute rounded-full bg-white"
                          style={{ width: 10, height: 10, top: 3, left: on ? 15 : 3, transition: 'left 0.15s' }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="phase-strip">
                <span style={{ fontSize: 18 }}>⚽</span>
                <div className="text-sm text-secondary">
                  <strong className="text-primary">Goal popups</strong> appear automatically on all screens when scores change — no extra config needed. Enable a sport here and live events trigger overlay alerts instantly.
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {SPORTS.map(sport => {
                  const on = !!sports[sport.id]
                  return (
                    <span
                      key={sport.id}
                      className="tag"
                      style={{
                        color:       on ? 'var(--tcp-blue)' : 'var(--text-tertiary)',
                        background:  on ? 'rgba(0,159,227,0.12)' : 'transparent',
                        borderColor: on ? 'rgba(0,159,227,0.3)' : 'var(--border-subtle)',
                      }}
                    >
                      {sport.label} {on ? 'ON' : 'off'}
                    </span>
                  )
                })}
              </div>
              <p className="text-xs text-tertiary">
                To request changes to sports settings, send a message to the SuperAdmin via the Messages tab.
              </p>
            </>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
