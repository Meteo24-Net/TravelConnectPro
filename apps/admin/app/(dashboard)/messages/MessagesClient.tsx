'use client'

import { useState, useTransition } from 'react'
import { sendMessageAction, markReadAction } from './actions'

interface Message {
  id:         string
  from_role:  string
  subject:    string
  body:       string
  category:   string
  read_at:    string | null
  created_at: string
}

interface Props {
  hotelId:  string
  role:     string
  messages: Message[]
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  general: { label: 'General',         color: 'var(--tcp-green)' },
  feature: { label: 'Feature request', color: 'var(--tcp-blue)' },
  bug:     { label: 'Bug / problem',   color: 'var(--tcp-red)' },
  billing: { label: 'Billing',         color: 'var(--tcp-amber)' },
  alert:   { label: 'Urgent',          color: 'var(--tcp-red)' },
}

function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function CategoryTag({ category }: { category: string }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.general
  return (
    <span className="tag" style={{
      color:       meta.color,
      background:  `${meta.color}1a`,
      borderColor: `${meta.color}44`,
      fontSize:    10,
    }}>
      {meta.label}
    </span>
  )
}

export default function MessagesClient({ hotelId, role, messages: initial }: Props) {
  const [messages, setMessages]       = useState<Message[]>(initial)
  const [openId, setOpenId]           = useState<string | null>(null)
  const [composing, setComposing]     = useState(false)
  const [subject, setSubject]         = useState('')
  const [body, setBody]               = useState('')
  const [category, setCategory]       = useState('general')
  const [error, setError]             = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const isSuper      = role === 'super_admin'
  const otherParty   = isSuper ? 'Hotel Manager' : 'TCP SuperAdmin'
  const openMessage  = messages.find(m => m.id === openId)
  const unreadCount  = messages.filter(m => !m.read_at && m.from_role !== role).length

  function handleOpen(msg: Message) {
    setOpenId(msg.id)
    setComposing(false)

    if (!msg.read_at && msg.from_role !== role) {
      setMessages(ms => ms.map(m => m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m))
      markReadAction(hotelId, msg.id).catch(() => {})
    }
  }

  function handleCompose() {
    setComposing(true)
    setOpenId(null)
    setSubject('')
    setBody('')
    setCategory('general')
    setError(null)
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) { setError('Subject and message are required'); return }
    startTransition(async () => {
      const result = await sendMessageAction(hotelId, subject, body, category)
      if (result.ok) {
        // Optimistically add to list
        const newMsg: Message = {
          id:        `temp-${Date.now()}`,
          from_role: role,
          subject:   subject.trim(),
          body:      body.trim(),
          category,
          read_at:   new Date().toISOString(),
          created_at: new Date().toISOString(),
        }
        setMessages(ms => [newMsg, ...ms])
        setComposing(false)
        setOpenId(newMsg.id)
      } else {
        setError(result.error ?? 'Failed to send')
      }
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>Messages</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          Internal communication between you and {otherParty}.
          {unreadCount > 0 && (
            <span style={{ color: 'var(--tcp-blue)', fontWeight: 600 }}> {unreadCount} unread.</span>
          )}
        </p>
      </div>

      <div className="flex gap-5" style={{ minHeight: 560 }}>
        {/* Inbox list */}
        <div className="section-card shrink-0 flex flex-col" style={{ width: 300 }}>
          <div className="section-head">
            <div className="section-title">Inbox</div>
            <button className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={handleCompose}>
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-tertiary">
                No messages yet
              </div>
            ) : (
              messages.map(msg => {
                const isFromMe = msg.from_role === role
                const isUnread = !msg.read_at && !isFromMe
                const selected = openId === msg.id

                return (
                  <div
                    key={msg.id}
                    onClick={() => handleOpen(msg)}
                    className="px-4 py-3 cursor-pointer border-b transition-colors"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      background: selected
                        ? 'rgba(0,159,227,0.08)'
                        : isUnread
                        ? 'rgba(255,255,255,0.02)'
                        : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {isUnread && (
                          <span className="dot shrink-0" style={{ background: 'var(--tcp-blue)', boxShadow: '0 0 6px var(--tcp-blue)' }} />
                        )}
                        <span className="text-xs font-semibold truncate" style={{ color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {isFromMe ? 'You' : otherParty}
                        </span>
                      </div>
                      <span className="text-tertiary shrink-0" style={{ fontSize: 10 }}>
                        {formatRelative(msg.created_at)}
                      </span>
                    </div>
                    <div className="text-sm truncate" style={{ fontWeight: isUnread ? 600 : 400, color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {msg.subject}
                    </div>
                    <div className="text-tertiary truncate mt-0.5" style={{ fontSize: 11 }}>
                      {msg.body.substring(0, 55)}…
                    </div>
                    <div className="mt-1.5">
                      <CategoryTag category={msg.category} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Reading pane / Compose */}
        <div className="section-card flex-1 flex flex-col">
          {composing ? (
            <>
              <div className="section-head">
                <div className="section-title">New message to {otherParty}</div>
                <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setComposing(false)}>
                  × Cancel
                </button>
              </div>
              <div className="section-body flex-1 space-y-4">
                <div>
                  <label className="block text-xs text-secondary mb-1.5 font-medium">Category</label>
                  <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="general">🟢 General</option>
                    <option value="feature">🔵 Feature request</option>
                    <option value="bug">🔴 Bug / problem</option>
                    <option value="billing">🟡 Billing</option>
                    <option value="alert">⚠️ Urgent / hardware</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-secondary mb-1.5 font-medium">Subject</label>
                  <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary…" autoFocus />
                </div>
                <div>
                  <label className="block text-xs text-secondary mb-1.5 font-medium">Message</label>
                  <textarea className="textarea" rows={10} value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Describe the issue or request in detail…"
                    style={{ resize: 'vertical' }} />
                </div>
                {error && (
                  <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded p-2">{error}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setComposing(false)}>Cancel</button>
                  <button
                    className="btn-primary"
                    onClick={handleSend}
                    disabled={!subject.trim() || !body.trim() || isPending}
                    style={{ opacity: isPending ? 0.6 : 1 }}
                  >
                    {isPending ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </div>
            </>
          ) : openMessage ? (
            <>
              <div className="section-head">
                <div>
                  <div className="section-title">{openMessage.subject}</div>
                  <div className="text-tertiary mt-1" style={{ fontSize: 11 }}>
                    From <strong style={{ color: 'var(--text-secondary)' }}>
                      {openMessage.from_role === role ? 'You' : otherParty}
                    </strong>
                    {' · '}
                    {new Date(openMessage.created_at).toLocaleString('en-GB', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
                <CategoryTag category={openMessage.category} />
              </div>
              <div className="section-body flex-1">
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-secondary mb-6">
                  {openMessage.body}
                </div>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={handleCompose}>
                  ↩ Reply
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-tertiary">
              Select a message to read, or click <strong className="text-primary mx-1">+ New</strong> to compose.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
