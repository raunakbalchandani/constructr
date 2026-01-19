/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark professional theme - inspired by Linear/Vercel
        dark: {
          900: '#0a0a0b',
          800: '#111113',
          700: '#18181b',
          600: '#27272a',
          500: '#3f3f46',
          400: '#52525b',
          300: '#71717a',
          200: '#a1a1aa',
          100: '#d4d4d8',
        },
        accent: {
          primary: '#3b82f6',    // Blue
          secondary: '#8b5cf6',  // Purple
          success: '#22c55e',    // Green
          warning: '#f59e0b',    // Amber
          danger: '#ef4444',     // Red
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(to right, #1f1f23 1px, transparent 1px), linear-gradient(to bottom, #1f1f23 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}
