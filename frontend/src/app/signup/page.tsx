'use client'

import { useState } from 'react'
import { Building2, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Registration failed')
      }
      
      // Auto-login after registration
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      if (loginRes.ok) {
        const data = await loginRes.json()
        localStorage.setItem('token', data.access_token)
        window.location.href = '/dashboard'
      } else {
        window.location.href = '/login'
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const benefits = [
    'AI-powered document analysis',
    'Instant conflict detection',
    'Unlimited chat questions',
    '14-day free trial'
  ]

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          {/* Back link */}
          <Link href="/" className="inline-flex items-center text-dark-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to home
          </Link>

          {/* Logo */}
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-accent-secondary rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">Foreperson.ai</span>
          </div>

          <h1 className="text-3xl font-bold mb-2">Create your account</h1>
          <p className="text-dark-400 mb-8">Start your free 14-day trial today</p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="input-label">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="John Smith"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="input-label">Work Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="john@construction.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="input-label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-dark-500 mt-2">Must be at least 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Create account'
              )}
            </button>

            <p className="text-xs text-dark-500 text-center">
              By signing up, you agree to our{' '}
              <a href="#" className="text-brand-400 hover:text-brand-300">Terms</a>
              {' '}and{' '}
              <a href="#" className="text-brand-400 hover:text-brand-300">Privacy Policy</a>
            </p>
          </form>

          <p className="mt-8 text-center text-dark-400">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Benefits */}
      <div className="hidden lg:flex flex-1 bg-dark-800 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent-secondary/20 rounded-full blur-3xl" />
        
        <div className="relative p-12 max-w-lg">
          <h2 className="text-3xl font-bold mb-8">What you get with Foreperson.ai</h2>
          
          <ul className="space-y-4">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-accent-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-accent-success" />
                </div>
                <span className="text-lg">{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="mt-12 p-6 glass rounded-xl">
            <p className="text-dark-300 italic">
              "Foreperson.ai has completely changed how we handle project documents. 
              What used to take hours now takes minutes."
            </p>
            <div className="mt-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white font-bold">
                JD
              </div>
              <div>
                <p className="font-medium">John Doe</p>
                <p className="text-sm text-dark-400">Project Manager, ABC Construction</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
