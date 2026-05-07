'use client'

import { useState, useTransition } from 'react'
import { addQrAction, updateQrAction, deleteQrAction, updateVerificationAction } from './actions'

interface QrAsset {
  id:              string
  qr_id:           string
  label:           string
  tier:            'open' | 'verified'
  category:        string
  destination_url: string
  enabled:         boolean
  reward_title:    string | null
  reward_value_gel: number | null
  fulfillment_mode: string | null
  scans_today:     number
}

interface Props {
  hotelId:           string
  isSuper:           boolean
  qrAssets:          QrAsset[]
  geofenceRadius:    number
  pinRotationMin:    number
  currentPin:        string | null
  pinExpiresAt:      string | null
}

const CATEGORIES = ['wifi', 'info', 'social', 'reward', 'quest_node', 'game_prize']

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

function FlowNode({ num, title, sub, color, success }: { num: string; title: string; sub: string; color: string; success?: boolean }) {
  return (
    <div className="flex-shrink-0 rounded-lg border p-3" style={{
      background: success ? 'rgba(46,204,113,0.05)' : 'var(--bg-input)',
      borderColor: success ? 'rgba(46,204,113,0.3)' : 'var(--border-default)',
      minWidth: 130,
    }}>
      <div className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-xs font-bold mb-1.5" style={{
        background: color + '22', color, border: `1px solid ${color}55`
      }}>{num}</div>
      <div className="text-xs font-semibold leading-tight">{title}</div>
      <div className="text-tertiary text-xs leading-tight mt-1">{sub}</div>
    </div>
  )
}

export default function QrClient({
  hotelId, isSuper, qrAssets: initial, geofenceRadius: gr, pinRotationMin: prm, currentPin, pinExpiresAt
}: Props) {
  const [assets, setAssets]          = useState<QrAsset[]>(initial)
  const [filter, setFilter]          = useState<'all'|'open'|'verified'>('all')
  const [editingId, setEditingId]    = useState<string | null>(null)
  const [showAdd, setShowAdd]        = useState<'open'|'verified'|null>(null)
  const [geofence, setGeofence]      = useState(gr)
  const [pinRot, setPinRot]          = useState(prm)
  const [toast, setToast]            = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Add form
  const [newLabel, setNewLabel]   = useState('')
  const [newQrId, setNewQrId]     = useState('')
  const [newUrl, setNewUrl]       = useState('')
  const [newCat, setNewCat]       = useState('info')
  const [newRewardTitle, setNewRewardTitle] = useState('')
  const [newRewardGel, setNewRewardGel]     = useState(0)
  const [newFulfillment, setNewFulfillment] = useState('auto')

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  // Inline field edit on blur
  function handleFieldBlur(id: string, field: string, value: unknown) {
    startTransition(async () => {
      const r = await updateQrAction(hotelId, id, { [field]: value })
      if (!r.ok) showToast(r.error ?? 'Failed', false)
    })
  }

  function handleToggle(asset: QrAsset) {
    setAssets(a => a.map(x => x.id === asset.id ? { ...x, enabled: !x.enabled } : x))
    startTransition(async () => {
      const r = await updateQrAction(hotelId, asset.id, { enabled: !asset.enabled })
      if (!r.ok) {
        setAssets(a => a.map(x => x.id === asset.id ? { ...x, enabled: asset.enabled } : x))
        showToast(r.error ?? 'Failed', false)
      }
    })
  }

  function handleDelete(id: string) {
    setAssets(a => a.filter(x => x.id !== id))
    setEditingId(null)
    startTransition(async () => {
      const r = await deleteQrAction(hotelId, id)
      showToast(r.ok ? 'QR deleted' : r.error ?? 'Failed', r.ok)
      if (!r.ok) setAssets(initial) // revert
    })
    setConfirmDelete(null)
  }

  async function handleAdd() {
    const data = {
      qr_id: newQrId || `qr-${Date.now()}`,
      label: newLabel,
      tier: showAdd!,
      category: newCat,
      destination_url: newUrl,
      ...(showAdd === 'verified' ? {
        reward_title: newRewardTitle,
        reward_value_gel: newRewardGel,
        fulfillment_mode: newFulfillment,
      } : {}),
    }
    const r = await addQrAction(hotelId, data)
    if (r.ok) {
      showToast(`${showAdd === 'open' ? 'Open' : 'Verified'} QR added`, true)
      setShowAdd(null)
      setNewLabel(''); setNewQrId(''); setNewUrl(''); setNewCat('info')
      setNewRewardTitle(''); setNewRewardGel(0); setNewFulfillment('auto')
      window.location.reload()
    } else {
      showToast(r.error ?? 'Failed to add', false)
    }
  }

  function saveVerification() {
    startTransition(async () => {
      const r = await updateVerificationAction(hotelId, { geofence_radius_m: geofence, lobby_pin_rotation_min: pinRot })
      showToast(r.ok ? 'Verification settings saved' : r.error ?? 'Failed', r.ok)
    })
  }

  const filtered  = assets.filter(a => filter === 'all' || a.tier === filter)
  const openCount = assets.filter(a => a.tier === 'open').length
  const verCount  = assets.filter(a => a.tier === 'verified').length

  // PIN countdown
  let pinCountdown = ''
  if (pinExpiresAt) {
    const remaining = Math.max(0, Math.floor((new Date(pinExpiresAt).getTime() - Date.now()) / 1000))
    pinCountdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>QR codes</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          Two-tier system: Open QRs scan instantly. Verified QRs require Proof of Proximity for monetised rewards.
        </p>
      </div>

      {/* Tier explainer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { icon: '⚡', label: 'OPEN TIER', count: openCount, color: 'var(--tcp-green)', bg: 'rgba(46,204,113,0.05)', border: 'rgba(46,204,113,0.2)',
            desc: 'Wi-Fi, menus, info, social. Signed JWT in URL → 302 redirect → done in 150ms. Zero friction, anonymous device tracking only.' },
          { icon: '🛡', label: 'VERIFIED TIER', count: verCount, color: 'var(--tcp-blue)', bg: 'rgba(0,159,227,0.05)', border: 'rgba(0,159,227,0.2)',
            desc: 'Late checkout, free drinks, upgrades. Requires Proof of Proximity: geolocation within radius, fallback to lobby PIN.' },
        ].map(t => (
          <div key={t.label} className="p-4 rounded-lg border" style={{ background: t.bg, borderColor: t.border }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span className="text-sm font-semibold" style={{ color: t.color }}>{t.label} · {t.count} cards</span>
            </div>
            <p className="text-xs text-secondary leading-relaxed">{t.desc}</p>
          </div>
        ))}
      </div>

      {/* Verification settings */}
      <div className="section-card" style={{ borderLeft: '3px solid var(--tcp-amber)' }}>
        <div className="section-head">
          <div className="section-title flex items-center gap-2">
            <span style={{ color: 'var(--tcp-amber)' }}>⚙</span> Verification settings
          </div>
          {isSuper && (
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={saveVerification} disabled={isPending}>
              Save
            </button>
          )}
        </div>
        <div className="section-body grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Geofence radius (m)" hint="GPS distance from hotel that counts as on-property">
            <input className="input font-mono" type="number" min={50} max={2000}
              value={geofence} onChange={e => setGeofence(parseInt(e.target.value) || 200)}
              disabled={!isSuper} />
          </Field>
          <Field label="Lobby PIN rotation (min)" hint="How often the on-screen 4-digit code changes">
            <input className="input font-mono" type="number" min={1} max={60}
              value={pinRot} onChange={e => setPinRot(parseInt(e.target.value) || 5)}
              disabled={!isSuper} />
          </Field>
          <div>
            <label className="block text-xs text-secondary mb-1.5 font-medium">Current lobby PIN (live)</label>
            <div className="rounded-lg border flex items-center justify-between px-3 py-2"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)' }}>
              <span className="font-mono font-bold" style={{ fontSize: 24, color: 'var(--tcp-amber)', letterSpacing: 6 }}>
                {currentPin ?? '----'}
              </span>
              {pinCountdown && (
                <span className="text-tertiary font-mono" style={{ fontSize: 11 }}>expires {pinCountdown}</span>
              )}
            </div>
            <div className="text-tertiary mt-1" style={{ fontSize: 11 }}>Displayed on lobby TV. Rotates automatically.</div>
          </div>
        </div>
      </div>

      {/* Filter + add buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center rounded-lg border p-0.5" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)' }}>
          {([['all', `All (${assets.length})`], ['open', `⚡ Open (${openCount})`], ['verified', `🛡 Verified (${verCount})`]] as const).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f as typeof filter)}
              className="px-4 py-1.5 rounded text-xs font-semibold transition-colors"
              style={{
                background:  filter === f ? 'var(--bg-panel-2)' : 'transparent',
                color:       filter === f ? (f === 'open' ? 'var(--tcp-green)' : f === 'verified' ? 'var(--tcp-blue)' : 'var(--text-primary)') : 'var(--text-tertiary)',
              }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowAdd('open')}>+ Open QR</button>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowAdd('verified')}>+ Verified QR</button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="section-card" style={{ borderTop: `3px solid ${showAdd === 'open' ? 'var(--tcp-green)' : 'var(--tcp-blue)'}` }}>
          <div className="section-head">
            <div className="section-title">{showAdd === 'open' ? '⚡ New Open QR' : '🛡 New Verified QR'}</div>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setShowAdd(null)}>Cancel</button>
          </div>
          <div className="section-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Label" hint="Shown above QR on screen">
                <input className="input" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Guest Wi-Fi" />
              </Field>
              <Field label="QR ID" hint="Lowercase, no spaces (auto-generated if blank)">
                <input className="input font-mono" value={newQrId} onChange={e => setNewQrId(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="wifi" />
              </Field>
              <Field label="Category">
                <select className="select" value={newCat} onChange={e => setNewCat(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <div className="md:col-span-3">
                <Field label="Destination URL">
                  <input className="input font-mono" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." />
                </Field>
              </div>
            </div>

            {showAdd === 'verified' && (
              <div className="rounded-lg p-4 space-y-3" style={{ background: 'rgba(0,159,227,0.04)', border: '1px solid rgba(0,159,227,0.2)' }}>
                <div className="text-xs font-semibold" style={{ color: 'var(--tcp-blue)' }}>🎁 Reward configuration</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <Field label="Reward title">
                      <input className="input" value={newRewardTitle} onChange={e => setNewRewardTitle(e.target.value)} placeholder="Free cocktail at the bar" />
                    </Field>
                  </div>
                  <Field label="Value (GEL)">
                    <input className="input font-mono" type="number" min={0} value={newRewardGel} onChange={e => setNewRewardGel(parseInt(e.target.value) || 0)} />
                  </Field>
                  <Field label="Fulfillment">
                    <select className="select" value={newFulfillment} onChange={e => setNewFulfillment(e.target.value)}>
                      <option value="auto">Auto-fulfill (instant)</option>
                      <option value="approval">Manager approval (Telegram)</option>
                    </select>
                  </Field>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button className="btn-primary" onClick={handleAdd} disabled={!newLabel || !newUrl || isPending}>
                {isPending ? 'Adding…' : `Add ${showAdd === 'open' ? 'open' : 'verified'} QR`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="section-card">
            <div className="section-body text-center py-10 text-sm text-tertiary">
              No QR codes yet. Add one above.
            </div>
          </div>
        )}
        {filtered.map(asset => {
          const isOpen     = asset.tier === 'open'
          const tierColor  = isOpen ? 'var(--tcp-green)' : 'var(--tcp-blue)'
          const isEditing  = editingId === asset.id

          return (
            <div key={asset.id} className="rounded-lg border transition-colors"
              style={{
                background: 'var(--bg-input)',
                borderColor: isEditing ? 'var(--tcp-blue)' : 'var(--border-default)',
                borderLeftWidth: 3, borderLeftColor: tierColor,
              }}>
              {/* Compact row */}
              <div className="p-4 flex items-start gap-4">
                {/* QR code image */}
                <div className="rounded-md overflow-hidden shrink-0 bg-white p-1.5" style={{ width: 64, height: 64 }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(asset.destination_url)}&size=120x120`}
                    alt="QR"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold">{asset.label}</span>
                    <span className="tag" style={{ background: `${tierColor}11`, color: tierColor, borderColor: `${tierColor}44` }}>
                      {isOpen ? '⚡' : '🛡'} {isOpen ? 'OPEN' : 'VERIFIED'}
                    </span>
                    {!isOpen && asset.fulfillment_mode && (
                      <span className="tag" style={{
                        color: asset.fulfillment_mode === 'auto' ? 'var(--tcp-green)' : 'var(--tcp-amber)',
                        background: asset.fulfillment_mode === 'auto' ? 'rgba(46,204,113,0.12)' : 'rgba(245,158,11,0.12)',
                        borderColor: asset.fulfillment_mode === 'auto' ? 'rgba(46,204,113,0.3)' : 'rgba(245,158,11,0.3)',
                      }}>
                        {asset.fulfillment_mode === 'auto' ? 'auto-fulfill' : 'approval'}
                      </span>
                    )}
                    <span className="tag" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)', background: 'transparent', fontSize: 9 }}>
                      {asset.category}
                    </span>
                  </div>
                  <div className="font-mono text-tertiary truncate" style={{ fontSize: 11 }}>{asset.destination_url}</div>
                  {!isOpen && asset.reward_title && (
                    <div className="text-secondary text-xs mt-1">
                      <strong className="text-primary">{asset.reward_title}</strong>
                      {asset.reward_value_gel ? <span className="text-tertiary"> · {asset.reward_value_gel} GEL</span> : null}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="font-mono text-xs text-tertiary">{asset.scans_today} scans today</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggle(asset)}
                      className="rounded-full" style={{
                        width: 36, height: 20, border: 'none', cursor: 'pointer',
                        background: asset.enabled ? 'var(--tcp-blue)' : 'rgba(255,255,255,0.1)',
                        position: 'relative',
                      }}>
                      <div className="absolute rounded-full bg-white" style={{
                        width: 14, height: 14, top: 3, transition: 'left 0.15s',
                        left: asset.enabled ? 19 : 3,
                      }} />
                    </button>
                    <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                      onClick={() => setEditingId(isEditing ? null : asset.id)}>
                      {isEditing ? '× Close' : '✎ Edit'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded edit */}
              {isEditing && (
                <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Label">
                      <input className="input" defaultValue={asset.label}
                        onBlur={e => handleFieldBlur(asset.id, 'label', e.target.value)} />
                    </Field>
                    <Field label="Category">
                      <select className="select" defaultValue={asset.category}
                        onBlur={e => handleFieldBlur(asset.id, 'category', e.target.value)}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Destination URL">
                        <input className="input font-mono" defaultValue={asset.destination_url}
                          onBlur={e => handleFieldBlur(asset.id, 'destination_url', e.target.value)} />
                      </Field>
                    </div>
                  </div>

                  {!isOpen && (
                    <div className="rounded-lg p-4 space-y-3" style={{ background: 'rgba(0,159,227,0.04)', border: '1px solid rgba(0,159,227,0.2)' }}>
                      <div className="text-xs font-semibold" style={{ color: 'var(--tcp-blue)' }}>🎁 Reward</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-3">
                          <Field label="Reward title">
                            <input className="input" defaultValue={asset.reward_title ?? ''}
                              onBlur={e => handleFieldBlur(asset.id, 'reward_title', e.target.value)} />
                          </Field>
                        </div>
                        <Field label="Value (GEL)">
                          <input className="input font-mono" type="number" defaultValue={asset.reward_value_gel ?? 0}
                            onBlur={e => handleFieldBlur(asset.id, 'reward_value_gel', parseInt(e.target.value) || 0)} />
                        </Field>
                        <Field label="Fulfillment">
                          <select className="select" defaultValue={asset.fulfillment_mode ?? 'auto'}
                            onBlur={e => handleFieldBlur(asset.id, 'fulfillment_mode', e.target.value)}>
                            <option value="auto">Auto-fulfill</option>
                            <option value="approval">Manager approval</option>
                          </select>
                        </Field>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="font-mono text-tertiary" style={{ fontSize: 10 }}>id: {asset.qr_id}</span>
                    {confirmDelete === asset.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary">Confirm delete?</span>
                        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, color: 'var(--tcp-red)' }}
                          onClick={() => handleDelete(asset.id)}>Yes, delete</button>
                        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: 'var(--tcp-red)' }}
                        onClick={() => setConfirmDelete(asset.id)}>× Delete QR</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Proof-of-Proximity flow */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-title">Proof-of-Proximity flow (Tier 2 only)</div>
          <span className="tag" style={{ color: 'var(--tcp-blue)', background: 'rgba(0,159,227,0.12)', borderColor: 'rgba(0,159,227,0.3)', fontSize: 10 }}>
            runs on every verified scan
          </span>
        </div>
        <div className="section-body">
          <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
            <FlowNode num="1" title="Guest scans verified QR" sub="JWT validated, qr_id resolved" color="var(--tcp-blue)" />
            <div className="flex items-center text-tertiary shrink-0" style={{ fontSize: 18 }}>→</div>
            <FlowNode num="2" title="Try Geolocation API" sub={`Within ${geofence}m of hotel?`} color="var(--tcp-green)" />
            <div className="flex items-center text-tertiary shrink-0" style={{ fontSize: 18 }}>→</div>
            <FlowNode num="3a" title="✓ GPS verified" sub="Reward unlocked" color="var(--tcp-green)" success />
            <div className="flex items-center text-tertiary shrink-0" style={{ fontSize: 18 }}>→</div>
            <FlowNode num="3b" title="✗ GPS failed" sub="Show lobby PIN entry" color="var(--tcp-amber)" />
            <div className="flex items-center text-tertiary shrink-0" style={{ fontSize: 18 }}>→</div>
            <FlowNode num="4" title={`Enter ${pinRot}-min PIN`} sub="From lobby TV display" color="var(--tcp-amber)" />
            <div className="flex items-center text-tertiary shrink-0" style={{ fontSize: 18 }}>→</div>
            <FlowNode num="5" title="Match → Verified" sub="Reward unlocked" color="var(--tcp-green)" success />
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
