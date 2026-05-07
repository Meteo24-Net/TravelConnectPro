'use client'

import { useState, useTransition } from 'react'
import { approveRewardAction, rejectRewardAction, updateFulfillmentConfigAction } from './actions'

interface Approval {
  id:              string
  reward_title:    string
  reward_value_gel: number | null
  created_at:      string
  qr_asset_id:     string | null
}

interface VerifiedQr {
  id:               string
  label:            string
  reward_title:     string | null
  reward_value_gel: number | null
  fulfillment_mode: string | null
  claimed_today:    number
  daily_cap:        number
}

interface Props {
  hotelId:           string
  isSuper:           boolean
  pendingApprovals:  Approval[]
  verifiedQrs:       VerifiedQr[]
  autoThresholdGel:  number
  telegramEnabled:   boolean
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

function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function FulfillmentClient({
  hotelId, isSuper,
  pendingApprovals: initialPending,
  verifiedQrs,
  autoThresholdGel: initialThreshold,
  telegramEnabled: initialTg,
}: Props) {
  const [pending, setPending]          = useState<Approval[]>(initialPending)
  const [threshold, setThreshold]      = useState(initialThreshold)
  const [tgEnabled, setTgEnabled]      = useState(initialTg)
  const [toast, setToast]              = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition]   = useTransition()
  const [deciding, setDeciding]        = useState<string | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 4000)
  }

  function handleApprove(approval: Approval) {
    setDeciding(approval.id)
    startTransition(async () => {
      const r = await approveRewardAction(hotelId, approval.id)
      if (r.ok) {
        setPending(p => p.filter(x => x.id !== approval.id))
        showToast('Reward approved — guest receives confirmation in PWA wallet', true)
      } else {
        showToast(r.error ?? 'Failed', false)
      }
      setDeciding(null)
    })
  }

  function handleReject(approval: Approval) {
    setDeciding(approval.id)
    startTransition(async () => {
      const r = await rejectRewardAction(hotelId, approval.id)
      if (r.ok) {
        setPending(p => p.filter(x => x.id !== approval.id))
        showToast('Reward rejected — guest receives polite decline', true)
      } else {
        showToast(r.error ?? 'Failed', false)
      }
      setDeciding(null)
    })
  }

  function saveRules() {
    startTransition(async () => {
      const r = await updateFulfillmentConfigAction(hotelId, { auto_threshold_gel: threshold, telegram_enabled: tgEnabled })
      showToast(r.ok ? 'Fulfillment rules saved' : r.error ?? 'Failed', r.ok)
    })
  }

  const totalClaimed      = verifiedQrs.reduce((s, q) => s + q.claimed_today, 0)
  const autoFulfilled     = verifiedQrs.filter(q => q.fulfillment_mode === 'auto').reduce((s, q) => s + q.claimed_today, 0)
  const approvalRequired  = verifiedQrs.filter(q => q.fulfillment_mode === 'approval').reduce((s, q) => s + q.claimed_today, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>Fulfillment</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          Hybrid rule-based fulfillment. Low-value rewards auto-fulfill instantly. High-value rewards need your approval.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { num: totalClaimed,     label: 'Claimed today',     trend: 'across all verified QRs', color: 'var(--text-secondary)' },
          { num: autoFulfilled,    label: 'Auto-fulfilled',     trend: 'instant Telegram notify',  color: 'var(--tcp-green)' },
          { num: approvalRequired, label: 'Approval required',  trend: 'manager decision',         color: 'var(--tcp-amber)' },
          { num: pending.length,   label: 'Pending now',        trend: 'awaiting your decision',   color: pending.length > 0 ? 'var(--tcp-red)' : 'var(--tcp-green)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-num" style={{ color: s.color }}>{s.num}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-trend" style={{ color: s.color }}>{s.trend}</div>
          </div>
        ))}
      </div>

      {/* Pending approvals */}
      <div className="section-card" style={{ borderLeft: '3px solid var(--tcp-amber)' }}>
        <div className="section-head">
          <div className="section-title flex items-center gap-2">
            <span style={{ color: 'var(--tcp-amber)' }}>⏳</span>
            Pending approvals
            {pending.length > 0 && (
              <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--tcp-red)' }}>
                {pending.length}
              </span>
            )}
          </div>
          <span className="text-tertiary" style={{ fontSize: 11 }}>also sent to Telegram with inline approve/reject buttons</span>
        </div>
        <div className="section-body">
          {pending.length === 0 ? (
            <div className="text-center py-8 text-tertiary text-sm">
              <div style={{ fontSize: 32, opacity: 0.3 }}>✓</div>
              <div className="mt-2">No pending approvals. All caught up.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map(approval => (
                <div key={approval.id} className="flex items-center gap-4 p-3 rounded-lg border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <span style={{ fontSize: 18 }}>🎁</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{approval.reward_title}</div>
                    <div className="text-tertiary text-xs mt-0.5 flex flex-wrap gap-x-3">
                      {approval.reward_value_gel != null && (
                        <span>Value: <strong style={{ color: 'var(--text-primary)' }}>{approval.reward_value_gel} GEL</strong></span>
                      )}
                      <span>Requested: {formatRelative(approval.created_at)}</span>
                      <span className="font-mono">id: {approval.id.slice(0, 8)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      className="btn-ghost"
                      style={{ padding: '5px 12px', fontSize: 12, color: 'var(--tcp-red)', opacity: deciding === approval.id ? 0.5 : 1 }}
                      onClick={() => handleReject(approval)}
                      disabled={deciding === approval.id}
                    >
                      ✗ Reject
                    </button>
                    <button
                      className="btn-primary"
                      style={{ padding: '5px 14px', fontSize: 12, opacity: deciding === approval.id ? 0.5 : 1 }}
                      onClick={() => handleApprove(approval)}
                      disabled={deciding === approval.id}
                    >
                      ✓ Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reward roster */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-title">All verified rewards — today's usage</div>
          <span className="text-tertiary" style={{ fontSize: 11 }}>caps reset at midnight</span>
        </div>
        <div className="section-body">
          {verifiedQrs.length === 0 ? (
            <div className="text-center py-8 text-sm text-tertiary">
              No verified QRs configured. Add them in the QR tab.
            </div>
          ) : (
            <div className="space-y-2">
              {verifiedQrs.map(qr => {
                const cap       = qr.daily_cap > 0 ? qr.daily_cap : null
                const pct       = cap ? (qr.claimed_today / cap) * 100 : 0
                const exhausted = cap ? qr.claimed_today >= cap : false
                const isAuto    = qr.fulfillment_mode === 'auto'

                return (
                  <div key={qr.id} className="flex items-center gap-4 p-3 rounded-lg border"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)', opacity: exhausted ? 0.7 : 1 }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{qr.label}</span>
                        <span className="tag" style={{
                          color:       isAuto ? 'var(--tcp-green)' : 'var(--tcp-amber)',
                          background:  isAuto ? 'rgba(46,204,113,0.12)' : 'rgba(245,158,11,0.12)',
                          borderColor: isAuto ? 'rgba(46,204,113,0.3)' : 'rgba(245,158,11,0.3)',
                          fontSize: 10,
                        }}>
                          {isAuto ? 'auto' : 'approval'}
                        </span>
                        {exhausted && (
                          <span className="tag" style={{ color: 'var(--tcp-red)', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', fontSize: 10 }}>
                            CAP REACHED
                          </span>
                        )}
                      </div>
                      {qr.reward_title && (
                        <div className="text-tertiary text-xs">{qr.reward_title}{qr.reward_value_gel ? ` · ${qr.reward_value_gel} GEL` : ''}</div>
                      )}
                    </div>

                    <div style={{ width: 220 }}>
                      {cap ? (
                        <>
                          <div className="flex justify-between mb-1 text-xs">
                            <span className="text-tertiary">{qr.claimed_today} / {cap} claimed</span>
                            <span className="font-mono">{Math.round(pct)}%</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-panel)' }}>
                            <div className="h-full transition-all rounded-full" style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: exhausted ? 'var(--tcp-red)' : pct > 80 ? 'var(--tcp-amber)' : 'var(--tcp-green)',
                            }} />
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-tertiary">
                          {qr.claimed_today} claimed · <span style={{ color: 'var(--tcp-blue)' }}>no cap</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fulfillment rules — SuperAdmin only */}
      {isSuper && (
        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Fulfillment rules</div>
            <div className="flex items-center gap-3">
              <span className="tag" style={{ color: 'var(--tcp-blue)', background: 'rgba(0,159,227,0.12)', borderColor: 'rgba(0,159,227,0.3)', fontSize: 10 }}>
                SuperAdmin only
              </span>
              <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={saveRules} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          <div className="section-body grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs text-secondary mb-1.5 font-medium">
                Auto-fulfill threshold (GEL)
              </label>
              <input className="input font-mono" type="number" min={0}
                value={threshold} onChange={e => setThreshold(parseInt(e.target.value) || 0)} />
              <div className="text-tertiary mt-1" style={{ fontSize: 11 }}>
                Rewards below this value auto-fulfill. Above it requires manager approval.
                Currently: <strong style={{ color: 'var(--text-primary)' }}>≤ {threshold} GEL → auto</strong>,{' '}
                <strong style={{ color: 'var(--tcp-amber)' }}>{threshold + 1}+ GEL → approval</strong>.
              </div>
            </div>

            <div>
              <label className="block text-xs text-secondary mb-1.5 font-medium">Telegram fulfillment</label>
              <button
                onClick={() => setTgEnabled(t => !t)}
                className="flex items-center gap-3 w-full p-3 rounded-lg border text-left"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)' }}
              >
                <div className="rounded-full shrink-0" style={{
                  width: 40, height: 22,
                  background: tgEnabled ? 'var(--tcp-blue)' : 'rgba(255,255,255,0.1)',
                  position: 'relative',
                }}>
                  <div className="absolute rounded-full bg-white" style={{
                    width: 16, height: 16, top: 3, transition: 'left 0.15s',
                    left: tgEnabled ? 21 : 3,
                  }} />
                </div>
                <div className="flex-1 text-sm">
                  Telegram bot {tgEnabled ? 'connected' : 'disabled'}
                </div>
                <span className="tag" style={{
                  color:       tgEnabled ? 'var(--tcp-green)' : 'var(--text-tertiary)',
                  background:  tgEnabled ? 'rgba(46,204,113,0.12)' : 'transparent',
                  borderColor: tgEnabled ? 'rgba(46,204,113,0.3)' : 'var(--border-subtle)',
                  fontSize: 10,
                }}>
                  {tgEnabled ? 'live' : 'off'}
                </span>
              </button>
              <div className="text-tertiary mt-1" style={{ fontSize: 11 }}>
                Sends instant notification with inline approve/reject buttons for high-value rewards.
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
