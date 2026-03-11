/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f1117',
          dark:    '#090b0f',
          card:    '#171b25',
          hover:   '#1e2333',
          border:  '#2a2f40',
        },
        accent: {
          DEFAULT: '#6366f1', // indigo-500
          light:   '#818cf8',
          dark:    '#4f46e5',
        },
        pin: {
          exif:   '#22c55e', // green – GPS from EXIF
          manual: '#f59e0b', // amber – user-placed
          none:   '#64748b', // slate – no location
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-up':   'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        'pulse-pin':  'pulsePin 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:   { '0%': { opacity: 0 },                   '100%': { opacity: 1 } },
        slideUp:  { '0%': { opacity: 0, transform: 'translateY(12px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulsePin: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
