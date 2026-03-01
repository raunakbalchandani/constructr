'use client'

import Link from 'next/link'
import { FileText, MessageSquare, AlertTriangle, ArrowRight, Shield, Zap } from 'lucide-react'

const DOC_TYPES = [
  'RFI', 'CONTRACT', 'SPECIFICATION', 'SUBMITTAL', 'CHANGE ORDER',
  'DRAWING SET', 'BID PACKAGE', 'SCHEDULE', 'PUNCH LIST', 'ASI', 'SHOP DRAWING',
]

const FEATURES = [
  {
    num: '01',
    icon: FileText,
    title: 'Document Analysis',
    desc: 'Parse PDFs, Word docs, and spreadsheets. Extract critical data from any construction document automatically.',
  },
  {
    num: '02',
    icon: MessageSquare,
    title: 'AI Chat',
    desc: 'Ask anything about your project documents. Get precise, cited answers from an expert construction AI.',
  },
  {
    num: '03',
    icon: AlertTriangle,
    title: 'Conflict Detection',
    desc: 'Surface contradictions between specs, contracts, and drawings before they become costly field problems.',
  },
  {
    num: '04',
    icon: Shield,
    title: 'Secure Workspace',
    desc: 'Your documents are private to your workspace. Role-based access and encryption as the default.',
  },
  {
    num: '05',
    icon: Zap,
    title: 'Instant Summaries',
    desc: 'Plain-English summary of any document in seconds. Stop reading 200-page specifications line by line.',
  },
  {
    num: '06',
    icon: FileText,
    title: 'Multi-Format',
    desc: 'PDFs, Word docs, Excel sheets, and more. Works with every file already sitting on your desk.',
  },
]

export default function LandingPage() {
  const tickerItems = [...DOC_TYPES, ...DOC_TYPES]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50"
        style={{
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 flex items-center justify-center flex-shrink-0"
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
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.12em' }}
            >
              Foreperson.ai
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="text-xs font-medium uppercase tracking-wider transition-colors"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}
            >
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary text-xs px-4 py-2">
              Get started →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            opacity: 0.35,
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-24">
          {/* Section marker */}
          <div className="flex items-center gap-3 mb-10">
            <span
              className="label-mono-accent"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              // AI-POWERED CONSTRUCTION INTELLIGENCE
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-display text-[clamp(4rem,10vw,9rem)] font-black uppercase leading-none tracking-tight mb-8"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 0.9 }}
          >
            Your docs,
            <br />
            <span style={{ color: 'var(--accent)' }}>decoded.</span>
          </h1>

          {/* Subtext + CTAs in two columns */}
          <div className="flex flex-col md:flex-row md:items-end gap-8 md:gap-16">
            <p
              className="text-base leading-relaxed max-w-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Upload contracts, RFIs, and specs. Ask questions in plain English.
              Foreperson finds conflicts before they find you on the job site.
            </p>

            <div className="flex items-center gap-4 flex-shrink-0">
              <Link
                href="/signup"
                className="btn-primary inline-flex items-center gap-2 px-6 py-3"
              >
                Start for free <ArrowRight size={14} />
              </Link>
              <Link href="/login" className="btn-ghost inline-flex items-center gap-2 px-6 py-3">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Document type ticker ──────────────────────────────── */}
      <div
        className="border-y overflow-hidden"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div className="flex animate-ticker whitespace-nowrap" style={{ width: 'max-content' }}>
          {tickerItems.map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-6 py-2.5 flex-shrink-0"
            >
              <span
                className="text-xs uppercase tracking-widest"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
              >
                {t}
              </span>
              <span style={{ color: 'var(--border)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>◆</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features grid ────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        {/* Section label */}
        <div className="flex items-center gap-4 mb-12">
          <span className="label-mono-accent">// CAPABILITIES</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          <span className="label-mono">06 MODULES</span>
        </div>

        {/* Grid — uses hairline border gaps to create the grid lines */}
        <div
          className="grid md:grid-cols-3 gap-px"
          style={{ backgroundColor: 'var(--border)' }}
        >
          {FEATURES.map(({ num, icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group p-7 transition-colors duration-150"
              style={{ backgroundColor: 'var(--card)' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--card)'
              }}
            >
              {/* Number + icon row */}
              <div className="flex items-center justify-between mb-6">
                <div
                  className="w-8 h-8 flex items-center justify-center"
                  style={{ backgroundColor: 'var(--surface)' }}
                >
                  <Icon size={15} style={{ color: 'var(--accent)' }} />
                </div>
                <span
                  className="label-mono group-hover:text-accent transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {num}
                </span>
              </div>

              <h3
                className="text-sm font-bold uppercase tracking-wide mb-2"
                style={{ letterSpacing: '0.06em' }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div
          className="relative overflow-hidden p-12 md:p-16"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {/* Right edge shadow */}
          <div
            className="absolute inset-y-0 right-0 w-48 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.15), transparent)' }}
          />
          {/* Corner marks */}
          <div
            className="absolute top-4 left-4 w-5 h-5 border-t border-l"
            style={{ borderColor: 'rgba(0,0,0,0.25)' }}
          />
          <div
            className="absolute bottom-4 right-4 w-5 h-5 border-b border-r"
            style={{ borderColor: 'rgba(0,0,0,0.25)' }}
          />

          <div className="relative">
            <p
              className="label-mono mb-4"
              style={{ color: 'rgba(0,0,0,0.45)', fontFamily: 'var(--font-mono)' }}
            >
              // START YOUR PROJECT
            </p>
            <h2
              className="text-5xl md:text-7xl font-black uppercase leading-none tracking-tight mb-8"
              style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-display)' }}
            >
              Work smarter,
              <br />
              deliver faster.
            </h2>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-7 py-3.5 font-bold text-sm uppercase tracking-wider transition-all"
              style={{
                backgroundColor: 'var(--accent-dark)',
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
              }}
            >
              Get started free <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div
          className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between"
        >
          <span className="label-mono">© 2026 FOREPERSON.AI</span>
          <span className="label-mono">BUILT FOR THE FIELD</span>
        </div>
      </footer>
    </div>
  )
}
