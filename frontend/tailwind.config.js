/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0A0A0F',
          surface: '#12121A',
          card: '#1A1A25',
          border: '#2A2A3A',
          accent: '#c4507a',
          'accent-hover': '#d4608a',
          'accent-dim': '#8a3856',
          text: '#E8E8F0',
          'text-dim': '#8888A0',
          success: '#4ADE80',
          warning: '#FBBF24',
          error: '#F87171',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
