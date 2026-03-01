'use client'

import Link from 'next/link'
import { FileText, MessageSquare, GitCompare, ArrowRight, Shield, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Nav */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-sm"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(10,10,10,0.85)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
            Foreperson.ai
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm transition-theme"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary text-sm">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-28 pb-20 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-8"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
          AI-powered construction intelligence
        </div>

        <h1
          className="text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          Your documents,{' '}
          <span className="text-gradient">understood.</span>
        </h1>

        <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
          Upload contracts, RFIs, and specs. Ask questions. Find conflicts.
          Foreperson reads your construction docs so you don&apos;t have to.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="btn-primary inline-flex items-center gap-2 glow-accent px-6 py-3 text-base"
          >
            Start for free
            <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="btn-ghost inline-flex items-center gap-2 px-6 py-3 text-base">
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: FileText,
              title: 'Document Analysis',
              description:
                'Parse PDFs, DOCX, and spreadsheets. Extract key info automatically from any construction document.',
            },
            {
              icon: MessageSquare,
              title: 'AI Chat',
              description:
                'Ask anything about your documents. Get precise, cited answers from an expert construction AI.',
            },
            {
              icon: GitCompare,
              title: 'Conflict Detection',
              description:
                'Automatically surface contradictions between specs, contracts, and drawings before they become problems.',
            },
            {
              icon: Shield,
              title: 'Secure by Default',
              description:
                'Your documents are private to your workspace. Role-based access, encrypted at rest.',
            },
            {
              icon: Zap,
              title: 'Instant Summaries',
              description:
                'Get a plain-English summary of any document in seconds. No more reading 200-page specs.',
            },
            {
              icon: FileText,
              title: 'Multi-Format Support',
              description:
                'Works with PDFs, Word docs, Excel sheets, and more. Construction files of any kind.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="card transition-all duration-200"
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px var(--glow)'
                ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <Icon size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div
          className="card text-center py-12"
          style={{ borderColor: 'var(--accent)', boxShadow: '0 0 40px var(--glow)' }}
        >
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Ready to work smarter on your next project?
          </h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Join construction professionals using Foreperson to cut document review time in half.
          </p>
          <Link
            href="/signup"
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base glow-accent"
          >
            Get started free
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div
          className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span className="text-xs">© 2026 Foreperson.ai</span>
          <span className="text-xs">Built for construction professionals</span>
        </div>
      </footer>
    </div>
  )
}
