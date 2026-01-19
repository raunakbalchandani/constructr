import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Foreperson.ai - Construction Document Intelligence',
  description: 'AI-powered platform for construction professionals to analyze, understand, and manage project documents.',
  keywords: ['construction', 'AI', 'documents', 'project management', 'RFI', 'submittals'],
  authors: [{ name: 'Foreperson.ai' }],
  openGraph: {
    title: 'Foreperson.ai - Construction Document Intelligence',
    description: 'AI-powered platform for construction professionals',
    url: 'https://foreperson.ai',
    siteName: 'Foreperson.ai',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-dark-900 text-white antialiased">
        {children}
      </body>
    </html>
  )
}
