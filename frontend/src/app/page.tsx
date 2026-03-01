'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  FileText, MessageSquare, AlertTriangle, ArrowRight,
  Shield, Zap, Layers, ChevronDown, ChevronUp
} from 'lucide-react'

const HERO_WORDS = ['docs', 'drawings', 'specs']

const DOC_TYPES = [
  'RFI', 'CONTRACT', 'SPECIFICATION', 'SUBMITTAL', 'CHANGE ORDER',
  'FLOOR PLAN', 'SITE PLAN', 'SHOP DRAWING', 'SCHEDULE', 'PUNCH LIST',
  'PAY APPLICATION', 'TRANSMITTAL', 'MEETING MINUTES', 'SAFETY REPORT',
  'COST REPORT', 'BID PACKAGE', 'ASI', 'BULLETIN', 'INSPECTION REPORT',
]

interface Feature {
  num: string
  icon: React.ElementType
  title: string
  desc: string
  detail: string
  tags: string[]
}

const FEATURES: Feature[] = [
  {
    num: '01',
    icon: Layers,
    title: 'Drawings & Plans',
    desc: 'Parse floor plans, site plans, elevations, sections, and shop drawings. Extract dimension, note, and scope data automatically.',
    detail: 'Supports PDF drawings, scanned blueprints (OCR-enabled), DWG/DXF exports, and image-based plans. Handles architectural, structural, MEP, civil, and landscape drawings. Works with full drawing sets or individual sheets.',
    tags: ['Floor Plans', 'Site Plans', 'Elevations', 'Shop Drawings', 'As-Builts'],
  },
  {
    num: '02',
    icon: FileText,
    title: 'Specs, Contracts & RFIs',
    desc: 'Read contracts, Division specs, submittals, change orders, RFIs, transmittals, and pay applications in seconds.',
    detail: 'Handles CSI MasterFormat specs (all 50 divisions), AIA contract documents, subcontracts, purchase orders, RFI logs, submittal registers, change order logs, CORs, PCOs, and owner pay applications with schedule of values.',
    tags: ['Contracts', 'Specifications', 'RFIs', 'Change Orders', 'Submittals'],
  },
  {
    num: '03',
    icon: MessageSquare,
    title: 'AI Chat Assistant',
    desc: 'Ask anything about your project files in plain English. Get cited, precise answers instantly.',
    detail: 'Query across your entire document set at once. "What are the liquidated damages?" · "List all submittals required in Division 22" · "What is the owner\'s right to terminate?" · "Summarize the RFI log by trade." Get answers with source references.',
    tags: ['Natural Language', 'Cross-Document', 'Source Citations', 'Multi-File'],
  },
  {
    num: '04',
    icon: AlertTriangle,
    title: 'Conflict Detection',
    desc: 'Surface contradictions between drawings, specs, and contracts before they hit the field.',
    detail: 'Catches scope gaps between trades, dimension conflicts between drawings and specs, schedule dependency issues, allowance vs. budget mismatches, duplicate scope items between subcontracts, and specification conflicts between divisions.',
    tags: ['Scope Gaps', 'Dimension Conflicts', 'Trade Overlap', 'Budget Variance'],
  },
  {
    num: '05',
    icon: Zap,
    title: 'Instant Summaries',
    desc: 'Get an executive summary of any file in seconds. Key dates, dollar amounts, responsibilities surfaced.',
    detail: 'Summarize a 300-page specification, a 50-line schedule of values, a complex RFI log, or a full meeting minutes set. Action items, open issues, dollar values, responsible parties, and deadlines are all surfaced automatically.',
    tags: ['Schedules', 'Budgets', 'Action Items', 'Meeting Minutes', 'Punch Lists'],
  },
  {
    num: '06',
    icon: Shield,
    title: 'Secure Project Workspace',
    desc: 'Every project is an isolated workspace. Your files stay private, encrypted, and access-controlled.',
    detail: 'Files are encrypted at rest and isolated per project. No cross-project data leakage. Designed for confidential construction documents: bid documents, contracts, subcontract pricing, financial reports, and legal correspondence.',
    tags: ['Encrypted at Rest', 'Project Isolation', 'Access Control', 'Confidential'],
  },
]

export default function LandingPage() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [wordIdx, setWordIdx] = useState(0)
  const [wordVisible, setWordVisible] = useState(true)
  const tickerItems = [...DOC_TYPES, ...DOC_TYPES]

  useEffect(() => {
    const interval = setInterval(() => {
      setWordVisible(false)
      setTimeout(() => {
        setWordIdx((i) => (i + 1) % HERO_WORDS.length)
        setWordVisible(true)
      }, 350)
    }, 2400)
    return () => clearInterval(interval)
  }, [])

  const toggleCard = (num: string) => {
    setExpandedCard(prev => prev === num ? null : num)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-mono)' }}>FP</span>
            </div>
            <span className="text-sm font-black tracking-widest uppercase" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.12em' }}>
              Foreperson.ai
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-xs font-medium uppercase tracking-wider transition-colors"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary text-xs px-4 py-2">Get started →</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.35,
        }} />

        <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-24">
          <div className="flex items-center gap-3 mb-10">
            <span className="label-mono-accent" style={{ fontFamily: 'var(--font-mono)' }}>
              // BUILT FOR CONSTRUCTION PROJECT MANAGERS
            </span>
          </div>

          <h1 className="font-black uppercase leading-none tracking-tight mb-8"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 0.9, fontSize: 'clamp(4rem, 10vw, 9rem)' }}>
            Your{' '}
            <span
              style={{
                color: 'var(--accent)',
                display: 'inline-block',
                opacity: wordVisible ? 1 : 0,
                transform: wordVisible ? 'translateY(0)' : 'translateY(-8px)',
                transition: 'opacity 0.35s ease, transform 0.35s ease',
                minWidth: '3ch',
              }}
            >
              {HERO_WORDS[wordIdx]}
            </span>
            ,<br />
            <span style={{ color: 'var(--text-primary)' }}>understood.</span>
          </h1>

          <div className="flex flex-col md:flex-row md:items-end gap-8 md:gap-16">
            <p className="text-base leading-relaxed max-w-md" style={{ color: 'var(--text-secondary)' }}>
              Upload your entire project — drawings, specs, contracts, RFIs, schedules, submittals.
              Ask questions. Find conflicts. Get summaries. Foreperson is your AI project manager that reads everything.
            </p>
            <div className="flex items-center gap-4 flex-shrink-0">
              <Link href="/signup" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
                Start for free <ArrowRight size={14} />
              </Link>
              <Link href="/login" className="btn-ghost inline-flex items-center gap-2 px-6 py-3">Sign in</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────────── */}
      <div className="border-y overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="flex animate-ticker whitespace-nowrap" style={{ width: 'max-content' }}>
          {tickerItems.map((t, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-2.5 flex-shrink-0">
              <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {t}
              </span>
              <span style={{ color: 'var(--border)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>◆</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features grid (expandable) ────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex items-center gap-4 mb-12">
          <span className="label-mono-accent">// WHAT IT HANDLES</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          <span className="label-mono">CLICK ANY CARD TO EXPAND</span>
        </div>

        <div className="grid md:grid-cols-3 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          {FEATURES.map((feature) => {
            const { num, icon: Icon, title, desc, detail, tags } = feature
            const isExpanded = expandedCard === num

            return (
              <div
                key={num}
                className="group cursor-pointer transition-colors duration-150"
                style={{ backgroundColor: isExpanded ? 'var(--surface)' : 'var(--card)' }}
                onClick={() => toggleCard(num)}
                onMouseEnter={(e) => {
                  if (!isExpanded) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface)'
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--card)'
                }}
              >
                <div className="p-7">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: isExpanded ? 'var(--card)' : 'var(--surface)' }}>
                      <Icon size={15} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="label-mono">{num}</span>
                      {isExpanded
                        ? <ChevronUp size={13} style={{ color: 'var(--accent)' }} />
                        : <ChevronDown size={13} style={{ color: 'var(--text-secondary)' }} />
                      }
                    </div>
                  </div>

                  <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ letterSpacing: '0.06em' }}>
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                      <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>{detail}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5"
                            style={{
                              backgroundColor: 'var(--bg)',
                              border: '1px solid var(--border)',
                              color: 'var(--accent)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6rem',
                              letterSpacing: '0.06em',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="flex items-center gap-4 mb-12">
          <span className="label-mono-accent">// WHO USES IT</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="grid md:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          {[
            { role: 'Project Manager', tasks: 'Track RFIs, change orders, and submittals. Stay on top of every open item.' },
            { role: 'Project Executive', tasks: 'Review contracts, budgets, and risk items across multiple projects instantly.' },
            { role: 'Superintendent', tasks: 'Pull spec sections, drawing notes, and installation requirements in the field.' },
            { role: 'Project Engineer', tasks: 'Log RFIs, track submittals, compare drawing revisions, and draft responses.' },
          ].map(({ role, tasks }) => (
            <div key={role} className="p-6" style={{ backgroundColor: 'var(--card)' }}>
              <p className="label-mono-accent mb-3" style={{ fontFamily: 'var(--font-mono)' }}>◆</p>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ letterSpacing: '0.06em' }}>{role}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{tasks}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden p-12 md:p-16" style={{ backgroundColor: 'var(--accent)' }}>
          <div className="absolute inset-y-0 right-0 w-48 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.15), transparent)' }} />
          <div className="absolute top-4 left-4 w-5 h-5 border-t border-l" style={{ borderColor: 'rgba(0,0,0,0.25)' }} />
          <div className="absolute bottom-4 right-4 w-5 h-5 border-b border-r" style={{ borderColor: 'rgba(0,0,0,0.25)' }} />
          <div className="relative">
            <p className="label-mono mb-4" style={{ color: 'rgba(0,0,0,0.45)', fontFamily: 'var(--font-mono)' }}>// READY TO GO</p>
            <h2 className="text-5xl md:text-7xl font-black uppercase leading-none tracking-tight mb-8"
              style={{ color: 'var(--accent-dark)', fontFamily: 'var(--font-display)' }}>
              Work smarter,<br />deliver faster.
            </h2>
            <Link href="/signup" className="inline-flex items-center gap-2 px-7 py-3.5 font-bold text-sm uppercase tracking-wider transition-all"
              style={{ backgroundColor: 'var(--accent-dark)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
              Get started free <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="label-mono">© 2026 FOREPERSON.AI</span>
          <span className="label-mono">BUILT FOR THE FIELD</span>
        </div>
      </footer>
    </div>
  )
}
