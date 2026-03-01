import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import './globals.css'

export const metadata: Metadata = {
  title: 'Foreperson.ai - Construction Document Intelligence',
  description: 'AI-powered platform for construction professionals to analyze, understand, and manage project documents.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
