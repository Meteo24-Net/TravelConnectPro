'use client'

import { useState, useTransition } from 'react'
import { addAirportAction, updateAirportAction, deleteAirportAction } from './actions'

interface Airport {
  id:                 string
  iata_code:          string
  airport_name:       string
  drive_time_minutes: number | null
  display_order:      number
  enabled:            boolean
}

interface Props {
  initialAirports: Airport[]
  isSuper:         boolean
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

export default function AirportsClient({ initialAirports, isSuper }: Props) {
  const [airports, setAirports]         = useState<Airport[]>(initialAirports)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition]    = useTransition()
  const [showAdd, setShowAdd]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Add form state
  const [newIata, setNewIata]           = useState('')
  const [newName, setNewName]           = useState('')
  const [newDrive, setNewDrive]         = useState('')

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function handleToggle(airport: Airport) {
    const updated = { ...airport, enabled: !airport.enabled }
    setAirports(airports.map(a => a.id === airport.id ? updated : a))
    startTransition(async () => {
      const result = await updateAirportAction(airport.id, { enabled: !airport.enabled })
      if (!result.ok) {
        setAirports(airports) // revert
        showToast(result.error ?? 'Failed', false)
      }
    })
  }

  function handleUpdateField(id: string, field: string, value: string | number) {
    setAirports(airports.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  function handleBlurSave(airport: Airport) {
    startTransition(async () => {
      const result = await updateAirportAction(airport.id, {
        airport_name:       airport.airport_name,
        drive_time_minutes: airport.drive_time_minutes ?? 0,
      })
      if (!result.ok) showToast(result.error ?? 'Failed to save', false)
    })
  }

  function handleMoveOrder(id: string, dir: -1 | 1) {
    const idx    = airports.findIndex(a => a.id === id)
    const target = idx + dir
    if (target < 0 || target >= airports.length) return

    const next = [...airports]
    ;[next[idx], next[target]] = [next[target], next[idx]]

    // Update display_order to match position
    const reordered = next.map((a, i) => ({ ...a, display_order: i }))
    setAirports(reordered)

    startTransition(async () => {
      await Promise.all([
        updateAirportAction(reordered[idx].id,    { display_order: idx }),
        updateAirportAction(reordered[target].id, { display_order: target }),
      ])
    })
  }

  async function handleAdd() {
    const result = await addAirportAction({
      iata_code:          newIata,
      airport_name:       newName,
      drive_time_minutes: parseInt(newDrive) || 0,
      display_order:      airports.length,
    })

    if (result.ok) {
      showToast(`${newIata.toUpperCase()} added`, true)
      setNewIata(''); setNewName(''); setNewDrive('')
      setShowAdd(false)
      // Optimistic: router.refresh() would re-fetch; for now show toast
      // User can refresh to see the new row, or we re-fetch
      window.location.reload()
    } else {
      showToast(result.error ?? 'Failed to add', false)
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteAirportAction(id)
    if (result.ok) {
      setAirports(airports.filter(a => a.id !== id))
      showToast('Airport removed', true)
    } else {
      showToast(result.error ?? 'Failed to remove', false)
    }
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: 22 }}>Airports</h1>
          <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
            Each airport auto-generates a Flights slide in the carousel and pulls live departure data.
          </p>
        </div>
        {isSuper && (
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            + Add airport
          </button>
        )}
      </div>

      {/* Info strip */}
      <div className="phase-strip">
        <span style={{ fontSize: 18 }}>✈</span>
        <div className="text-sm text-secondary">
          Adding an airport creates a <strong className="text-primary">Flights slide</strong> in the carousel automatically.
          Disable to hide from screens without deleting configuration.
        </div>
      </div>

      {/* Airport cards */}
      {airports.length === 0 ? (
        <div className="section-card">
          <div className="section-body">
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <span style={{ fontSize: 40 }}>✈</span>
              <div className="font-semibold text-primary">No airports configured</div>
              <div className="text-sm text-secondary">
                Add an airport to enable flight departure slides on your lobby TVs.
              </div>
              {isSuper && (
                <button className="btn-primary mt-2" onClick={() => setShowAdd(true)}>
                  + Add first airport
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {airports.map((airport, idx) => (
            <div
              key={airport.id}
              className="section-card"
              style={{ borderLeft: `3px solid ${airport.enabled ? 'var(--tcp-blue)' : 'var(--border-subtle)'}` }}
            >
              <div className="section-head">
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono font-bold"
                    style={{ fontSize: 18, color: airport.enabled ? 'var(--tcp-blue)' : 'var(--text-tertiary)' }}
                  >
                    {airport.iata_code}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{airport.airport_name}</div>
                    <div className="text-tertiary" style={{ fontSize: 11 }}>
                      Display order: {idx + 1}
                      {airport.drive_time_minutes ? ` · ${airport.drive_time_minutes} min drive` : ''}
                    </div>
                  </div>
                  <span
                    className="tag"
                    style={{
                      color:       airport.enabled ? 'var(--tcp-green)' : 'var(--text-tertiary)',
                      background:  airport.enabled ? 'rgba(46,204,113,0.12)' : 'transparent',
                      borderColor: airport.enabled ? 'rgba(46,204,113,0.3)' : 'var(--border-subtle)',
                    }}
                  >
                    {airport.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>

                {isSuper && (
                  <div className="flex items-center gap-2">
                    {/* Order controls */}
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 13 }}
                      onClick={() => handleMoveOrder(airport.id, -1)}
                      disabled={idx === 0 || isPending}
                    >↑</button>
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 13 }}
                      onClick={() => handleMoveOrder(airport.id, 1)}
                      disabled={idx === airports.length - 1 || isPending}
                    >↓</button>

                    {/* Enable toggle */}
                    <button
                      onClick={() => handleToggle(airport)}
                      className="rounded-full transition-all shrink-0"
                      style={{
                        width: 36, height: 20,
                        background: airport.enabled ? 'var(--tcp-blue)' : 'rgba(255,255,255,0.1)',
                        position: 'relative', border: 'none', cursor: 'pointer',
                      }}
                    >
                      <div
                        className="absolute rounded-full bg-white transition-all"
                        style={{ width: 14, height: 14, top: 3, left: airport.enabled ? 19 : 3 }}
                      />
                    </button>

                    {/* Delete */}
                    {confirmDelete === airport.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-secondary">Confirm?</span>
                        <button
                          className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: 11, color: 'var(--tcp-red)' }}
                          onClick={() => handleDelete(airport.id)}
                        >
                          Yes, remove
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 12, color: 'var(--tcp-red)' }}
                        onClick={() => setConfirmDelete(airport.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="section-body">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-secondary mb-1.5 font-medium">Airport name</label>
                    <input
                      className="input"
                      value={airport.airport_name}
                      disabled={!isSuper}
                      onChange={e => handleUpdateField(airport.id, 'airport_name', e.target.value)}
                      onBlur={() => handleBlurSave(airport)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-secondary mb-1.5 font-medium">Drive time (minutes)</label>
                    <input
                      className="input font-mono"
                      type="number"
                      min={0}
                      value={airport.drive_time_minutes ?? ''}
                      disabled={!isSuper}
                      onChange={e => handleUpdateField(airport.id, 'drive_time_minutes', parseInt(e.target.value) || 0)}
                      onBlur={() => handleBlurSave(airport)}
                      placeholder="e.g. 45"
                    />
                  </div>
                  <div className="flex items-end">
                    <div
                      className="flex items-center gap-2 w-full rounded-lg px-3 py-2"
                      style={{ background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.15)' }}
                    >
                      <span className="dot dot-on shrink-0" />
                      <div className="text-sm text-secondary">
                        Auto-generates{' '}
                        <strong style={{ color: 'var(--tcp-green)' }}>{airport.iata_code} flights slide</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add airport form */}
      {showAdd && (
        <div className="section-card" style={{ borderTop: '3px solid var(--tcp-blue)' }}>
          <div className="section-head">
            <div className="section-title">Add airport</div>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
          <div className="section-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-secondary mb-1.5 font-medium">IATA code</label>
                <input
                  className="input font-mono"
                  placeholder="BUS"
                  maxLength={3}
                  value={newIata}
                  onChange={e => setNewIata(e.target.value.toUpperCase())}
                  style={{ letterSpacing: '0.1em' }}
                />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1.5 font-medium">Airport name</label>
                <input
                  className="input"
                  placeholder="Batumi International Airport"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1.5 font-medium">Drive time (minutes)</label>
                <input
                  className="input font-mono"
                  type="number"
                  min={0}
                  placeholder="20"
                  value={newDrive}
                  onChange={e => setNewDrive(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                className="btn-primary"
                onClick={handleAdd}
                disabled={!newIata || !newName || isPending}
                style={{ opacity: (!newIata || !newName) ? 0.5 : 1 }}
              >
                {isPending ? 'Adding…' : `Add ${newIata || 'airport'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
