'use client'

import { useState, useTransition } from 'react'
import { updateMediaAction, testStreamAction } from './actions'

interface MediaConfig {
  bgm_label:              string
  bgm_url:                string
  bgm_volume:             number
  bgm_status:             'online' | 'offline' | 'unchecked'
  bgm_last_checked:       string | null
  use_corporate_video:    boolean
  feratel_cam_id:         string
  corporate_video_label:  string
  corporate_video_url:    string
  cam_popup_interval_min: number
}

interface Props {
  hotelId: string
  media:   MediaConfig
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

function StatusDot({ status }: { status: 'online' | 'offline' | 'unchecked' | 'checking' }) {
  const color = status === 'online' ? 'var(--tcp-green)'
              : status === 'checking' ? 'var(--tcp-amber)'
              : status === 'offline' ? 'var(--tcp-red)'
              : 'var(--text-tertiary)'
  const label = status === 'online' ? 'Online' : status === 'checking' ? 'Checking…' : status === 'offline' ? 'Offline' : 'Unchecked'
  return (
    <div className="flex items-center gap-2">
      <span className="dot" style={{ background: color, boxShadow: status === 'online' ? `0 0 6px ${color}` : 'none' }} />
      <span className="text-sm font-medium" style={{ color }}>{label}</span>
    </div>
  )
}

export default function MediaClient({ hotelId, media: initial }: Props) {
  const [media, setMedia]            = useState<MediaConfig>(initial)
  const [streamStatus, setStatus]    = useState<'online'|'offline'|'unchecked'|'checking'>(initial.bgm_status)
  const [toast, setToast]            = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isTesting, setIsTesting]    = useState(false)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  function set<K extends keyof MediaConfig>(key: K, val: MediaConfig[K]) {
    setMedia(m => ({ ...m, [key]: val }))
  }

  function handleSave() {
    startTransition(async () => {
      const toSave = { ...media, bgm_status: streamStatus as 'online' | 'offline' | 'unchecked' }
      const result = await updateMediaAction(hotelId, toSave)
      showToast(result.ok ? 'Media config saved' : result.error ?? 'Failed', result.ok)
    })
  }

  async function handleTestStream() {
    if (!media.bgm_url) { showToast('Enter a stream URL first', false); return }
    setIsTesting(true)
    setStatus('checking')
    const result = await testStreamAction(hotelId, media.bgm_url)
    const now    = new Date().toISOString()
    setStatus(result.status)
    setMedia(m => ({ ...m, bgm_status: result.status, bgm_last_checked: now }))
    showToast(
      result.status === 'online' ? 'Stream is online and reachable' : 'Stream is offline or unreachable',
      result.status === 'online',
    )
    setIsTesting(false)
  }

  const lastChecked = media.bgm_last_checked
    ? new Date(media.bgm_last_checked).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Never'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: 22 }}>Media & sound</h1>
          <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
            Background music stream, corporate video, and camera feed.
          </p>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={isPending} style={{ opacity: isPending ? 0.6 : 1 }}>
          {isPending ? 'Saving…' : 'Save media config'}
        </button>
      </div>

      {/* Background music */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-title">Background music</div>
          <StatusDot status={streamStatus} />
        </div>
        <div className="section-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Stream label" hint="Shown in dashboard — e.g. 'Lounge Jazz' or 'Radio Batumi'">
              <input className="input" value={media.bgm_label}
                onChange={e => set('bgm_label', e.target.value)}
                placeholder="e.g. Lounge Jazz" />
            </Field>
            <Field label="Default volume" hint="0–100 · can be overridden per screen">
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} step={1}
                  value={media.bgm_volume}
                  onChange={e => set('bgm_volume', parseInt(e.target.value))}
                  className="flex-1" />
                <span className="font-mono text-primary font-bold" style={{ width: 36, textAlign: 'right' }}>
                  {media.bgm_volume}
                </span>
              </div>
            </Field>
          </div>

          <Field label="Stream URL" hint="MP3 / AAC / Icecast / Shoutcast. Test before pushing to screens.">
            <div className="flex gap-2">
              <input className="input font-mono flex-1"
                value={media.bgm_url}
                onChange={e => set('bgm_url', e.target.value)}
                placeholder="https://stream.example.com/listen.mp3" />
              <button
                className="btn-ghost shrink-0"
                onClick={handleTestStream}
                disabled={isTesting}
                style={{ opacity: isTesting ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                {isTesting ? '⟳ Checking…' : '↻ Test link'}
              </button>
            </div>
          </Field>

          {/* Status row */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <StatusDot status={streamStatus} />
              <div className="text-tertiary" style={{ fontSize: 11 }}>
                Last checked: {lastChecked}
              </div>
            </div>
            <div className="text-tertiary" style={{ fontSize: 11 }}>Auto-checked hourly</div>
          </div>
        </div>
      </div>

      {/* Camera / corporate video */}
      <div className="section-card">
        <div className="section-head">
          <div className="section-title">Camera or corporate video</div>
        </div>
        <div className="section-body space-y-4">
          {/* Toggle */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: false, title: 'Live webcam (Feratel)', desc: 'Live view of the area — beach, mountain, landmark.' },
              { val: true,  title: 'Corporate video',       desc: 'Your hotel\'s promotional video. Plays in the cam slot.' },
            ].map(opt => {
              const selected = media.use_corporate_video === opt.val
              return (
                <button key={String(opt.val)}
                  onClick={() => set('use_corporate_video', opt.val)}
                  className="p-4 rounded-lg border text-left transition-all"
                  style={{
                    background:  selected ? 'rgba(0,159,227,0.05)' : 'var(--bg-input)',
                    borderColor: selected ? 'rgba(0,159,227,0.4)'  : 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{opt.title}</span>
                    {selected && (
                      <span className="tag" style={{ color: 'var(--tcp-blue)', background: 'rgba(0,159,227,0.12)', borderColor: 'rgba(0,159,227,0.3)', fontSize: 10 }}>
                        selected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-tertiary">{opt.desc}</div>
                </button>
              )
            })}
          </div>

          {/* Webcam fields */}
          {!media.use_corporate_video && (
            <Field label="Feratel camera ID" hint="UUID from your Feratel webcam embed code">
              <input className="input font-mono"
                value={media.feratel_cam_id}
                onChange={e => set('feratel_cam_id', e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </Field>
          )}

          {/* Corporate video fields */}
          {media.use_corporate_video && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Video label" hint="Internal reference">
                  <input className="input"
                    value={media.corporate_video_label}
                    onChange={e => set('corporate_video_label', e.target.value)}
                    placeholder="Hotel Welcome Tour 2026" />
                </Field>
                <Field label="Video URL (MP4)" hint="Direct MP4 link — file upload coming in v.2">
                  <input className="input font-mono"
                    value={media.corporate_video_url}
                    onChange={e => set('corporate_video_url', e.target.value)}
                    placeholder="https://..." />
                </Field>
              </div>
              {/* Preview */}
              <div>
                <label className="block text-xs text-secondary mb-1.5 font-medium">Preview</label>
                <div className="rounded-lg border flex items-center justify-center overflow-hidden"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', minHeight: 160 }}>
                  {media.corporate_video_url ? (
                    <video src={media.corporate_video_url} controls
                      style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6 }} />
                  ) : (
                    <span className="text-tertiary text-sm">No video URL set</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Popup interval */}
          <Field label="Cam popup interval (minutes)" hint="How often the cam/video appears as an overlay during carousel">
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={60} step={5}
                value={media.cam_popup_interval_min}
                onChange={e => set('cam_popup_interval_min', parseInt(e.target.value))}
                className="flex-1" />
              <span className="font-mono text-primary font-bold" style={{ width: 44, textAlign: 'right' }}>
                {media.cam_popup_interval_min === 0 ? 'off' : `${media.cam_popup_interval_min}m`}
              </span>
            </div>
          </Field>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}
