/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(110%)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutRight: {
          from: { opacity: '1', transform: 'translateX(0)' },
          to:   { opacity: '0', transform: 'translateX(110%)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.4)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        spinnerSpin: {
          to: { transform: 'rotate(360deg)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up':     'fadeInUp 0.45s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':        'fadeIn 0.3s ease-out both',
        'slide-in-right': 'slideInRight 0.38s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in':       'scaleIn 0.55s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
}
