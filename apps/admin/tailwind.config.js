/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // TCP brand
        'tcp-blue':      '#009FE3',
        'tcp-blue-dark': '#0077AD',
        'tcp-gold':      '#c5a059',
        'tcp-green':     '#2ecc71',
        'tcp-red':       '#ef4444',
        'tcp-amber':     '#f59e0b',
        // Admin surfaces
        'base':     '#0a0a0d',
        'panel':    '#14141a',
        'panel-2':  '#1c1c24',
        'input':    '#0f0f14',
        // Text
        'primary':   '#f5f5f7',
        'secondary': '#a1a1aa',
        'tertiary':  '#71717a',
      },
      borderColor: {
        'subtle':  'rgba(255,255,255,0.06)',
        'default': 'rgba(255,255,255,0.10)',
        'strong':  'rgba(255,255,255,0.18)',
      },
    },
  },
  plugins: [],
}
