'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const supabase                = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <span style={{ color: 'var(--tcp-blue)', fontSize: 22, fontWeight: 800 }}>TCP</span>
            <span className="text-tertiary" style={{ fontSize: 13 }}>Admin</span>
          </div>
          <div className="text-secondary text-sm">Travel Connect Pro</div>
        </div>

        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Manager sign in</div>
          </div>
          <div className="section-body">
            {sent ? (
              <div className="text-center py-4 space-y-3">
                <div style={{ fontSize: 32 }}>📬</div>
                <div className="text-sm text-primary font-semibold">Check your inbox</div>
                <div className="text-sm text-secondary">
                  We sent a magic link to <strong className="text-primary">{email}</strong>.
                  Click it to sign in — no password needed.
                </div>
                <button
                  className="btn-ghost w-full mt-4"
                  onClick={() => { setSent(false); setEmail('') }}
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs text-secondary mb-1.5 font-medium">
                    Email address
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="manager@hotel.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded p-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading || !email}
                >
                  {loading ? 'Sending…' : 'Send magic link'}
                </button>

                <p className="text-xs text-tertiary text-center">
                  Your email must be registered by your SuperAdmin.
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-tertiary mt-6">
          Travel Connect Pro · Powered by Anthropic Claude
        </p>
      </div>
    </div>
  )
}
