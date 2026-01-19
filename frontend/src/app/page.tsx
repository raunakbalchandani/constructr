'use client'

import { useState } from 'react'
import { 
  FileText, 
  MessageSquare, 
  Search, 
  Zap, 
  Shield, 
  Clock,
  ArrowRight,
  Check,
  Menu,
  X,
  ChevronRight,
  Building2,
  FileSearch,
  GitCompare
} from 'lucide-react'

// Navigation
function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-secondary rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">Foreperson.ai</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-dark-200 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-dark-200 hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="text-dark-200 hover:text-white transition-colors">Pricing</a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <a href="/login" className="btn-ghost">Sign In</a>
            <a href="/signup" className="btn-primary">Get Started</a>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2 text-dark-200 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-dark-700 animate-slide-down">
            <div className="flex flex-col space-y-4">
              <a href="#features" className="text-dark-200 hover:text-white px-4 py-2">Features</a>
              <a href="#how-it-works" className="text-dark-200 hover:text-white px-4 py-2">How it Works</a>
              <a href="#pricing" className="text-dark-200 hover:text-white px-4 py-2">Pricing</a>
              <div className="pt-4 border-t border-dark-700 flex flex-col space-y-2 px-4">
                <a href="/login" className="btn-secondary text-center">Sign In</a>
                <a href="/signup" className="btn-primary text-center">Get Started</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

// Hero Section
function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-secondary/20 rounded-full blur-3xl" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-dark-800 border border-dark-600 rounded-full mb-8 animate-fade-in">
            <span className="w-2 h-2 bg-accent-success rounded-full animate-pulse" />
            <span className="text-sm text-dark-200">AI-Powered Document Intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up">
            Understand Your
            <br />
            <span className="text-gradient">Construction Documents</span>
            <br />
            Instantly
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-dark-300 max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Upload contracts, specs, RFIs, and drawings. Ask questions in plain English. 
            Get instant answers with AI that understands construction.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <a href="/signup" className="btn-primary flex items-center space-x-2 text-lg">
              <span>Start Free Trial</span>
              <ArrowRight className="w-5 h-5" />
            </a>
            <a href="#how-it-works" className="btn-secondary flex items-center space-x-2">
              <span>See How It Works</span>
            </a>
          </div>

          {/* Social proof */}
          <p className="mt-8 text-sm text-dark-400 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            Trusted by construction professionals • No credit card required
          </p>
        </div>

        {/* Hero image/mockup */}
        <div className="mt-16 relative animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="glass rounded-2xl p-2 glow">
            <div className="bg-dark-800 rounded-xl overflow-hidden">
              {/* Browser mockup */}
              <div className="flex items-center space-x-2 px-4 py-3 border-b border-dark-700">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-dark-700 rounded-lg px-4 py-1.5 text-sm text-dark-400 max-w-md mx-auto">
                    foreperson.ai/dashboard
                  </div>
                </div>
              </div>
              
              {/* App screenshot placeholder */}
              <div className="aspect-video bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileSearch className="w-8 h-8 text-brand-400" />
                  </div>
                  <p className="text-dark-300 text-lg">Interactive Dashboard Preview</p>
                  <p className="text-dark-500 text-sm mt-2">Upload documents • Ask questions • Get insights</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Features Section
function Features() {
  const features = [
    {
      icon: FileText,
      title: 'Smart Document Parsing',
      description: 'Upload PDFs, Word docs, and Excel files. Our AI extracts and understands all the content.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: MessageSquare,
      title: 'AI Chat Assistant',
      description: 'Ask questions in plain English. Get instant answers with references to specific documents.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Search,
      title: 'Conflict Detection',
      description: 'Automatically find discrepancies between specs, drawings, and contracts.',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: GitCompare,
      title: 'Document Comparison',
      description: 'Compare any two documents side-by-side. Find differences and relationships.',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: Zap,
      title: 'Instant Summaries',
      description: 'Generate comprehensive summaries of any document with one click.',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your documents are encrypted and never shared. Enterprise-grade security.',
      color: 'from-indigo-500 to-purple-500'
    },
  ]

  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
          <p className="text-xl text-dark-300 max-w-2xl mx-auto">
            Powerful features designed specifically for construction professionals
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="card-hover group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} p-0.5 mb-4`}>
                <div className="w-full h-full bg-dark-800 rounded-[10px] flex items-center justify-center group-hover:bg-dark-700 transition-colors">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-dark-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// How It Works Section
function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Upload Documents',
      description: 'Drag and drop your contracts, specs, RFIs, submittals, and drawings.'
    },
    {
      number: '02',
      title: 'AI Processes Everything',
      description: 'Our AI reads, understands, and indexes all your documents automatically.'
    },
    {
      number: '03',
      title: 'Ask Questions',
      description: 'Type questions in plain English like "What are the HVAC specs?" or "Any conflicts?"'
    },
    {
      number: '04',
      title: 'Get Instant Answers',
      description: 'Receive detailed answers with references to the exact documents and sections.'
    },
  ]

  return (
    <section id="how-it-works" className="py-24 bg-dark-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-dark-300 max-w-2xl mx-auto">
            Get started in minutes, not days
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-brand-600 to-transparent" />
              )}
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-600/50 mb-4">
                  <span className="text-2xl font-bold text-brand-400">{step.number}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-dark-300">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Pricing Section
function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out Foreperson.ai',
      features: [
        '5 documents',
        'AI chat (limited)',
        'Basic summaries',
        'Email support'
      ],
      cta: 'Start Free',
      highlighted: false
    },
    {
      name: 'Pro',
      price: '$49',
      period: '/month',
      description: 'For individual professionals',
      features: [
        'Unlimited documents',
        'Unlimited AI chat',
        'Conflict detection',
        'Document comparison',
        'Export reports',
        'Priority support'
      ],
      cta: 'Start Free Trial',
      highlighted: true
    },
    {
      name: 'Team',
      price: '$199',
      period: '/month',
      description: 'For teams and companies',
      features: [
        'Everything in Pro',
        'Up to 10 users',
        'Shared workspaces',
        'Admin controls',
        'API access',
        'Dedicated support'
      ],
      cta: 'Contact Sales',
      highlighted: false
    },
  ]

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Simple Pricing</h2>
          <p className="text-xl text-dark-300 max-w-2xl mx-auto">
            Start free, upgrade when you need more
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`card relative ${plan.highlighted ? 'border-brand-500 glow' : ''}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-brand-600 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-dark-400 ml-1">{plan.period}</span>
                </div>
                <p className="text-dark-400 mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-accent-success flex-shrink-0" />
                    <span className="text-dark-200">{feature}</span>
                  </li>
                ))}
              </ul>

              <a 
                href="/signup"
                className={`block text-center py-3 rounded-lg font-medium transition-all ${
                  plan.highlighted 
                    ? 'bg-brand-600 hover:bg-brand-500 text-white' 
                    : 'bg-dark-700 hover:bg-dark-600 text-white border border-dark-600'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// CTA Section
function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-brand-600/20 to-accent-secondary/20" />
      <div className="absolute inset-0 grid-bg opacity-30" />
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl font-bold mb-4">
          Ready to Transform Your Document Workflow?
        </h2>
        <p className="text-xl text-dark-300 mb-8">
          Join construction professionals who are saving hours every week with AI-powered document intelligence.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="/signup" className="btn-primary flex items-center space-x-2 text-lg">
            <span>Get Started Free</span>
            <ArrowRight className="w-5 h-5" />
          </a>
          <a href="#features" className="btn-ghost flex items-center space-x-2">
            <span>Learn More</span>
            <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  )
}

// Footer
function Footer() {
  return (
    <footer className="py-12 border-t border-dark-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-secondary rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold">Foreperson.ai</span>
          </div>
          
          <div className="flex items-center space-x-6 text-dark-400">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          
          <p className="text-dark-500">
            © 2024 Foreperson.ai. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

// Main Page
export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  )
}
