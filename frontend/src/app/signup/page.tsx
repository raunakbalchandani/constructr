'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/api'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { access_token } = await auth.register(email, password, name)
      localStorage.setItem('token', access_token)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Left: brand panel ────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            opacity: 0.5,
          }}
        />

        {/* Corner marks */}
        <div className="absolute top-6 left-6 w-8 h-8 border-t border-l" style={{ borderColor: 'var(--accent)', opacity: 0.6 }} />
        <div className="absolute top-6 right-6 w-8 h-8 border-t border-r" style={{ borderColor: 'var(--accent)', opacity: 0.6 }} />
        <div className="absolute bottom-6 left-6 w-8 h-8 border-b border-l" style={{ borderColor: 'var(--accent)', opacity: 0.6 }} />
        <div className="absolute bottom-6 right-6 w-8 h-8 border-b border-r" style={{ borderColor: 'var(--accent)', opacity: 0.6 }} />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <span
                className="text-xs font-bold"
                style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-mono)' }}
              >
                FP
              </span>
            </div>
            <span
              className="text-sm font-black tracking-widest uppercase"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Foreperson.ai
            </span>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <p
            className="label-mono-accent mb-6"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            // START YOUR WORKSPACE
          </p>
          <h2
            className="font-black uppercase leading-none tracking-tight mb-5"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(3rem, 5vw, 5rem)',
              lineHeight: 0.9,
            }}
          >
            Stop reading.
            <br />
            <span style={{ color: 'var(--accent)' }}>Start knowing.</span>
          </h2>
          <p
            className="text-sm leading-relaxed max-w-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Join construction professionals who use Foreperson to cut document review
            time in half and catch conflicts before they become change orders.
          </p>
        </div>

        {/* Feature list */}
        <div
          className="relative z-10 space-y-3 border-t pt-8"
          style={{ borderColor: 'var(--border)' }}
        >
          {[
            'Parse PDFs, DOCX, Excel and more',
            'AI conflict detection across all documents',
            'Ask questions in plain English',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div
                className="w-4 h-4 flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span
                  className="text-xs font-bold leading-none"
                  style={{ color: 'var(--accent-dark)', fontSize: '0.55rem' }}
                >
                  ✓
                </span>
              </div>
              <p
                className="text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: form panel ────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 py-12"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 self-start">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <span
                className="text-xs font-bold"
                style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-mono)' }}
              >
                FP
              </span>
            </div>
            <span
              className="text-sm font-black tracking-widest uppercase"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Foreperson.ai
            </span>
          </Link>
        </div>

        <div className="w-full max-w-sm">
          {/* Form header */}
          <div className="mb-8">
            <p
              className="label-mono mb-2"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              // 01 — CREATE WORKSPACE
            </p>
            <h1
              className="text-3xl font-black uppercase tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Get started
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Jane Smith"
                required
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            {error && (
              <div
                className="text-xs px-3 py-2"
                style={{
                  color: '#f87171',
                  backgroundColor: 'rgba(248,113,113,0.07)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: '2px',
                }}
              >
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3 mt-2" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account →'}
            </button>
          </form>

          <p
            className="text-xs mt-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            Already have an account?{' '}
            <Link
              href="/login"
              style={{ color: 'var(--accent)', fontWeight: 600 }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
