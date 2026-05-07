'use client'

import { useState, useTransition } from 'react'
import {
  updateRequestStatusAction,
  addCatalogItemAction, updateCatalogItemAction, deleteCatalogItemAction,
  addChannelAction, updateChannelAction,
} from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceRequest {
  id:          string
  service_id:  string
  room_number: string
  status:      string
  priority:    string
  notes:       string | null
  created_at:  string
  device_hash: string
}

interface CatalogItem {
  id:           string
  service_id:   string
  name:         string
  emoji:        string | null
  priority:     string
  sla_minutes:  number | null
  channel_id:   string | null
  enabled:      boolean
}

interface Channel {
  id:                string
  channel_id:        string
  name:              string
  telegram_chat_id:  string | null
  manager_name:      string | null
  active:            boolean
}

interface Props {
  hotelId:   string
  isSuper:   boolean
  requests:  ServiceRequest[]
  catalog:   CatalogItem[]
  channels:  Channel[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  low:    'var(--tcp-green)',
  normal: 'var(--text-secondary)',
  high:   'var(--tcp-amber)',
  urgent: 'var(--tcp-red)',
}

const STATUS_COLOR: Record<string, string> = {
  pending:      'var(--tcp-amber)',
  acknowledged: 'var(--tcp-blue)',
  in_progress:  '#a855f7',
  completed:    'var(--tcp-green)',
  cancelled:    'var(--text-tertiary)',
}

function minutesAgo(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000)
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ServicesClient({ hotelId, isSuper, requests: initialReqs, catalog: initialCatalog, channels: initialChannels }: Props) {
  const [view, setView]              = useState<'queue'|'catalog'|'channels'>('queue')
  const [requests, setRequests]      = useState(initialReqs)
  const [catalog, setCatalog]        = useState(initialCatalog)
  const [channels, setChannels]      = useState(initialChannels)
  const [filter, setFilter]          = useState('all')
  const [toast, setToast]            = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Add forms
  const [showAddCatalog, setShowAddCatalog]   = useState(false)
  const [showAddChannel, setShowAddChannel]   = useState(false)
  const [newSvcId, setNewSvcId]               = useState('')
  const [newSvcName, setNewSvcName]           = useState('')
  const [newSvcEmoji, setNewSvcEmoji]         = useState('🛎')
  const [newSvcPriority, setNewSvcPriority]   = useState('low')
  const [newSvcSla, setNewSvcSla]             = useState(20)
  const [newSvcChannel, setNewSvcChannel]     = useState('')
  const [newChId, setNewChId]                 = useState('')
  const [newChName, setNewChName]             = useState('')
  const [newChTg, setNewChTg]                 = useState('')
  const [newChManager, setNewChManager]       = useState('')
  const [confirmDelete, setConfirmDelete]     = useState<string|null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  // ── Request status ──────────────────────────────────────────────────────────

  function handleStatus(req: ServiceRequest, status: 'acknowledged'|'in_progress'|'completed'|'cancelled') {
    setRequests(rs => rs.map(r => r.id === req.id ? { ...r, status } : r))
    startTransition(async () => {
      const r = await updateRequestStatusAction(hotelId, req.id, status)
      if (!r.ok) {
        setRequests(rs => rs.map(r2 => r2.id === req.id ? { ...r2, status: req.status } : r2))
        showToast(r.error ?? 'Failed', false)
      } else {
        showToast(`Request ${status.replace('_', ' ')}`, true)
      }
    })
  }

  // ── Catalog ─────────────────────────────────────────────────────────────────

  function handleCatalogToggle(item: CatalogItem) {
    setCatalog(c => c.map(x => x.id === item.id ? { ...x, enabled: !x.enabled } : x))
    startTransition(async () => {
      const r = await updateCatalogItemAction(hotelId, item.id, { enabled: !item.enabled })
      if (!r.ok) {
        setCatalog(c => c.map(x => x.id === item.id ? { ...x, enabled: item.enabled } : x))
        showToast(r.error ?? 'Failed', false)
      }
    })
  }

  function handleCatalogFieldBlur(id: string, field: string, value: unknown) {
    startTransition(async () => {
      const r = await updateCatalogItemAction(hotelId, id, { [field]: value })
      if (!r.ok) showToast(r.error ?? 'Failed', false)
    })
  }

  async function handleAddCatalog() {
    const r = await addCatalogItemAction(hotelId, {
      service_id: newSvcId, name: newSvcName, emoji: newSvcEmoji,
      priority: newSvcPriority, sla_minutes: newSvcSla, channel_id: newSvcChannel,
    })
    if (r.ok) { showToast('Service added', true); setShowAddCatalog(false); window.location.reload() }
    else showToast(r.error ?? 'Failed', false)
  }

  async function handleDeleteCatalog(id: string) {
    const r = await deleteCatalogItemAction(hotelId, id)
    if (r.ok) { setCatalog(c => c.filter(x => x.id !== id)); showToast('Service deleted', true) }
    else showToast(r.error ?? 'Failed', false)
    setConfirmDelete(null)
  }

  // ── Channels ────────────────────────────────────────────────────────────────

  function handleChannelToggle(ch: Channel) {
    setChannels(c => c.map(x => x.id === ch.id ? { ...x, active: !x.active } : x))
    startTransition(async () => {
      const r = await updateChannelAction(hotelId, ch.id, { active: !ch.enabled })
      if (!r.ok) {
        setChannels(c => c.map(x => x.id === ch.id ? { ...x, active: ch.enabled } : x))
        showToast(r.error ?? 'Failed', false)
      }
    })
  }

  function handleChannelBlur(id: string, field: string, value: string) {
    startTransition(async () => {
      const r = await updateChannelAction(hotelId, id, { [field]: value })
      if (!r.ok) showToast(r.error ?? 'Failed', false)
    })
  }

  async function handleAddChannel() {
    const r = await addChannelAction(hotelId, { channel_id: newChId, name: newChName, telegram_chat_id: newChTg, manager_name: newChManager })
    if (r.ok) { showToast('Channel added', true); setShowAddChannel(false); window.location.reload() }
    else showToast(r.error ?? 'Failed', false)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const pending      = requests.filter(r => r.status === 'pending').length
  const acknowledged = requests.filter(r => r.status === 'acknowledged').length
  const inProgress   = requests.filter(r => r.status === 'in_progress').length
  const completed    = requests.filter(r => r.status === 'completed').length
  const filtered     = requests.filter(r => filter === 'all' || r.status === filter)

  function getCatalogItem(serviceId: string) {
    return catalog.find(c => c.service_id === serviceId)
  }

  function getChannel(channelId: string | null) {
    return channels.find(c => c.channel_id === channelId)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>Service Requests</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          Guest requests routed to staff via Telegram. Configure services, routing, and SLA targets.
        </p>
      </div>

      {/* Sub-nav */}
      <div className="flex">
        {([
          ['queue',    `Live queue${pending > 0 ? ` (${pending})` : ''}`],
          ['catalog',  'Service catalog'],
          ['channels', 'Routing channels'],
        ] as const).map(([v, label], i) => (
          <button key={v} onClick={() => setView(v)}
            className="px-4 py-2 text-xs font-semibold border"
            style={{
              borderRadius: i === 0 ? '6px 0 0 6px' : i === 2 ? '0 6px 6px 0' : '0',
              borderColor: 'var(--border-default)',
              borderLeft: i > 0 ? 'none' : undefined,
              background: view === v ? 'var(--tcp-blue)' : 'var(--bg-panel)',
              color:      view === v ? 'white' : 'var(--text-secondary)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── QUEUE VIEW ──────────────────────────────────────────────────────── */}
      {view === 'queue' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { num: pending,      label: 'Pending',    color: 'var(--tcp-amber)' },
              { num: acknowledged, label: 'Acknowledged', color: 'var(--tcp-blue)' },
              { num: inProgress,   label: 'In progress', color: '#a855f7' },
              { num: completed,    label: 'Completed',  color: 'var(--tcp-green)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-num" style={{ color: s.color }}>{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="phase-strip">
            <span style={{ fontSize: 18 }}>📡</span>
            <div className="text-sm text-secondary">
              All requests fire to the routed Telegram channel. Status updates sync via Realtime — ack from here <strong className="text-primary">or</strong> from Telegram, both work.
            </div>
          </div>

          <div className="section-card">
            <div className="section-head">
              <div className="section-title">All service requests</div>
              <select className="select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
                value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="section-body space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-tertiary text-sm">No requests in this status.</div>
              ) : filtered.map(req => {
                const svc         = getCatalogItem(req.service_id)
                const ch          = getChannel(svc?.channel_id ?? null)
                const ago         = minutesAgo(req.created_at)
                const priorityColor = PRIORITY_COLOR[req.priority] ?? 'var(--text-secondary)'
                const statusColor   = STATUS_COLOR[req.status]    ?? 'var(--text-secondary)'
                const slaMin        = svc?.sla_minutes ?? 30
                const isOverdue     = ['pending','acknowledged'].includes(req.status) && ago > slaMin

                return (
                  <div key={req.id} className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{
                      background: 'var(--bg-input)',
                      borderColor: 'var(--border-subtle)',
                      borderLeftWidth: 3,
                      borderLeftColor: priorityColor,
                    }}>
                    <span style={{ fontSize: 22 }}>{svc?.emoji ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{svc?.name ?? req.service_id}</span>
                        <span className="font-mono text-xs text-tertiary">· Room {req.room_number}</span>
                        {req.priority === 'urgent' && (
                          <span className="tag" style={{ color: 'var(--tcp-red)', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', fontSize: 9 }}>URGENT</span>
                        )}
                      </div>
                      <div className="text-xs text-tertiary mt-0.5 flex flex-wrap gap-x-2">
                        {ch && <span>→ {ch.name}</span>}
                        <span>· {ago}m ago</span>
                        {req.notes && <span style={{ fontStyle: 'italic' }}>· "{req.notes}"</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOverdue ? (
                        <span className="tag" style={{ color: 'var(--tcp-red)', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' }}>⚠ OVERDUE</span>
                      ) : (
                        <span className="tag" style={{ color: statusColor, background: `${statusColor}1a`, borderColor: `${statusColor}44` }}>
                          {req.status.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                      {req.status === 'pending' && (
                        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => handleStatus(req, 'acknowledged')}>Ack</button>
                      )}
                      {req.status === 'acknowledged' && (
                        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => handleStatus(req, 'in_progress')}>Start</button>
                      )}
                      {req.status === 'in_progress' && (
                        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => handleStatus(req, 'completed')}>Mark done</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── CATALOG VIEW ────────────────────────────────────────────────────── */}
      {view === 'catalog' && (
        <>
          <div className="phase-strip">
            <span style={{ fontSize: 18 }}>◈</span>
            <div className="text-sm text-secondary">
              Configure which services guests can request. Toggle, change priority, set SLA, route to staff channels.
            </div>
          </div>

          <div className="space-y-2">
            {catalog.length === 0 && (
              <div className="section-card">
                <div className="section-body text-center py-10 text-sm text-tertiary">
                  No services configured yet. Add one below.
                </div>
              </div>
            )}
            {catalog.map(svc => (
              <div key={svc.id} className="section-card" style={{ opacity: svc.enabled ? 1 : 0.6 }}>
                <div className="section-body">
                  <div className="flex items-center gap-4">
                    <span style={{ fontSize: 28 }}>{svc.emoji ?? '📋'}</span>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                      <div>
                        <div className="text-sm font-semibold">{svc.name}</div>
                        <div className="font-mono text-xs text-tertiary">{svc.service_id}</div>
                      </div>
                      <Field label="Routes to">
                        <select className="select" style={{ fontSize: 12, padding: '5px 8px' }}
                          defaultValue={svc.channel_id ?? ''}
                          onBlur={e => handleCatalogFieldBlur(svc.id, 'channel_id', e.target.value || null)}>
                          <option value="">— none —</option>
                          {channels.map(c => <option key={c.id} value={c.channel_id}>{c.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Priority">
                        <select className="select" style={{ fontSize: 12, padding: '5px 8px' }}
                          defaultValue={svc.priority}
                          onBlur={e => handleCatalogFieldBlur(svc.id, 'priority', e.target.value)}>
                          <option value="low">🟢 Low</option>
                          <option value="normal">⚪ Normal</option>
                          <option value="high">🟡 High</option>
                          <option value="urgent">🔴 Urgent</option>
                        </select>
                      </Field>
                      <Field label="SLA (min)">
                        <input className="input font-mono" type="number" min={1} style={{ padding: '5px 8px', fontSize: 12 }}
                          defaultValue={svc.sla_minutes ?? 30}
                          onBlur={e => handleCatalogFieldBlur(svc.id, 'sla_minutes', parseInt(e.target.value) || 30)} />
                      </Field>
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => handleCatalogToggle(svc)}
                          className="rounded-full shrink-0" style={{
                            width: 36, height: 20, border: 'none', cursor: 'pointer',
                            background: svc.enabled ? 'var(--tcp-blue)' : 'rgba(255,255,255,0.1)',
                            position: 'relative',
                          }}>
                          <div className="absolute rounded-full bg-white" style={{
                            width: 14, height: 14, top: 3, transition: 'left 0.15s',
                            left: svc.enabled ? 19 : 3,
                          }} />
                        </button>
                        {isSuper && (
                          confirmDelete === svc.id ? (
                            <div className="flex gap-1">
                              <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11, color: 'var(--tcp-red)' }}
                                onClick={() => handleDeleteCatalog(svc.id)}>Delete</button>
                              <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }}
                                onClick={() => setConfirmDelete(null)}>Cancel</button>
                            </div>
                          ) : (
                            <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11, color: 'var(--tcp-red)' }}
                              onClick={() => setConfirmDelete(svc.id)}>×</button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add catalog item */}
          {showAddCatalog ? (
            <div className="section-card" style={{ borderTop: '3px solid var(--tcp-blue)' }}>
              <div className="section-head">
                <div className="section-title">Add service</div>
                <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setShowAddCatalog(false)}>Cancel</button>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Service ID" hint="Lowercase, no spaces">
                    <input className="input font-mono" value={newSvcId} onChange={e => setNewSvcId(e.target.value.toLowerCase().replace(/\s+/g,'-'))} placeholder="room-cleaning" />
                  </Field>
                  <Field label="Name">
                    <input className="input" value={newSvcName} onChange={e => setNewSvcName(e.target.value)} placeholder="Room Cleaning" />
                  </Field>
                  <Field label="Emoji">
                    <input className="input" value={newSvcEmoji} onChange={e => setNewSvcEmoji(e.target.value)} style={{ fontSize: 20 }} />
                  </Field>
                  <Field label="Priority">
                    <select className="select" value={newSvcPriority} onChange={e => setNewSvcPriority(e.target.value)}>
                      <option value="low">🟢 Low</option>
                      <option value="normal">⚪ Normal</option>
                      <option value="high">🟡 High</option>
                      <option value="urgent">🔴 Urgent</option>
                    </select>
                  </Field>
                  <Field label="SLA (minutes)">
                    <input className="input font-mono" type="number" min={1} value={newSvcSla} onChange={e => setNewSvcSla(parseInt(e.target.value)||20)} />
                  </Field>
                  <Field label="Routes to">
                    <select className="select" value={newSvcChannel} onChange={e => setNewSvcChannel(e.target.value)}>
                      <option value="">— none —</option>
                      {channels.map(c => <option key={c.id} value={c.channel_id}>{c.name}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="flex justify-end mt-4">
                  <button className="btn-primary" onClick={handleAddCatalog} disabled={!newSvcId || !newSvcName}>Add service</button>
                </div>
              </div>
            </div>
          ) : (
            <button className="btn-ghost w-full py-3" style={{ borderStyle: 'dashed', fontSize: 13 }}
              onClick={() => setShowAddCatalog(true)}>
              + Add service
            </button>
          )}
        </>
      )}

      {/* ── CHANNELS VIEW ───────────────────────────────────────────────────── */}
      {view === 'channels' && (
        <>
          <div className="phase-strip">
            <span style={{ fontSize: 18 }}>📡</span>
            <div className="text-sm text-secondary">
              Each service routes to one channel. Each channel = one staff team's Telegram chat.
              Build the pipeline yourself — never depend on Zapier for time-critical guest requests.
            </div>
          </div>

          <div className="space-y-2">
            {channels.length === 0 && (
              <div className="section-card">
                <div className="section-body text-center py-8 text-sm text-tertiary">
                  No channels configured. Add one below.
                </div>
              </div>
            )}
            {channels.map(ch => {
              const servicesCount = catalog.filter(s => s.channel_id === ch.channel_id && s.enabled).length
              return (
                <div key={ch.id} className="section-card">
                  <div className="section-body">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(0,159,227,0.15)', border: '1px solid rgba(0,159,227,0.3)' }}>
                        <span style={{ fontSize: 16 }}>👤</span>
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Channel name">
                          <input className="input" defaultValue={ch.name}
                            onBlur={e => handleChannelBlur(ch.id, 'name', e.target.value)} />
                        </Field>
                        <Field label="Telegram chat ID" hint="@username or numeric chat_id">
                          <input className="input font-mono" defaultValue={ch.telegram_chat_id ?? ''}
                            placeholder="@hotel_housekeeping"
                            onBlur={e => handleChannelBlur(ch.id, 'telegram_chat_id', e.target.value)} />
                        </Field>
                        <Field label="Manager name">
                          <input className="input" defaultValue={ch.manager_name ?? ''}
                            placeholder="e.g. Nino"
                            onBlur={e => handleChannelBlur(ch.id, 'manager_name', e.target.value)} />
                        </Field>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="tag" style={{ color: 'var(--tcp-blue)', background: 'rgba(0,159,227,0.12)', borderColor: 'rgba(0,159,227,0.3)', fontSize: 10 }}>
                          {servicesCount} services
                        </span>
                        <button onClick={() => handleChannelToggle(ch)}
                          className="rounded-full" style={{
                            width: 36, height: 20, border: 'none', cursor: 'pointer',
                            background: ch.enabled ? 'var(--tcp-blue)' : 'rgba(255,255,255,0.1)',
                            position: 'relative',
                          }}>
                          <div className="absolute rounded-full bg-white" style={{
                            width: 14, height: 14, top: 3, transition: 'left 0.15s',
                            left: ch.enabled ? 19 : 3,
                          }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add channel */}
          {isSuper && (showAddChannel ? (
            <div className="section-card" style={{ borderTop: '3px solid var(--tcp-blue)' }}>
              <div className="section-head">
                <div className="section-title">Add channel</div>
                <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setShowAddChannel(false)}>Cancel</button>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Channel ID" hint="Lowercase, no spaces">
                    <input className="input font-mono" value={newChId} onChange={e => setNewChId(e.target.value.toLowerCase().replace(/\s+/g,'-'))} placeholder="housekeeping" />
                  </Field>
                  <Field label="Name">
                    <input className="input" value={newChName} onChange={e => setNewChName(e.target.value)} placeholder="Housekeeping" />
                  </Field>
                  <Field label="Telegram chat ID">
                    <input className="input font-mono" value={newChTg} onChange={e => setNewChTg(e.target.value)} placeholder="@hotel_housekeeping" />
                  </Field>
                  <Field label="Manager name">
                    <input className="input" value={newChManager} onChange={e => setNewChManager(e.target.value)} placeholder="Nino" />
                  </Field>
                </div>
                <div className="flex justify-end mt-4">
                  <button className="btn-primary" onClick={handleAddChannel} disabled={!newChId || !newChName}>Add channel</button>
                </div>
              </div>
            </div>
          ) : (
            <button className="btn-ghost w-full py-3" style={{ borderStyle: 'dashed', fontSize: 13 }}
              onClick={() => setShowAddChannel(true)}>
              + Add channel
            </button>
          ))}

          {/* Fallback chain */}
          <div className="section-card" style={{ background: 'rgba(46,204,113,0.04)', borderColor: 'rgba(46,204,113,0.2)' }}>
            <div className="section-body">
              <div className="text-sm font-semibold mb-2" style={{ color: 'var(--tcp-green)' }}>Fallback chain (if Telegram fails)</div>
              <div className="text-sm text-secondary leading-relaxed">
                <strong className="text-primary">Telegram</strong> → <strong className="text-primary">Email</strong> → <strong className="text-primary">SMS</strong> → <strong className="text-primary">PWA push</strong>.
                Each step tries with a 2-minute timeout. The request always reaches a human — no service request silently fails.
              </div>
            </div>
          </div>
        </>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
