/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        // Semantic Theme Tokens
        t: {
          bg: 'var(--app-bg)',
          surface: 'var(--surface)',
          'surface-sec': 'var(--surface-sec)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          border: 'var(--border)',
          icon: 'var(--icon)',
          board: 'var(--board-bg)',
        },
        stone: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
        paper: '#F5F2EB',
        amber: {
          50: '#fffbeb',
          100: '#fef3c7', 
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'fade-out': 'fadeOut 0.3s ease-out forwards',
        'fade-in-medium': 'fadeIn 0.5s ease-out forwards',
        'fade-out-medium': 'fadeOut 0.5s ease-out forwards',
        'fade-in-long': 'fadeIn 1s ease-out forwards',
        'fade-out-long': 'fadeOut 1s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-in forwards',
        'slide-in-down': 'slideInDown 0.4s ease-out forwards',
        'pop': 'pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'scale-loop': 'scaleLoop 2s infinite ease-in-out',
        'gradient': 'gradient 8s ease infinite',
        'gradient-slow': 'gradient 32s ease infinite',
        'scan': 'scan 1.2s linear forwards',
        'reveal-premium': 'revealPremium 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'scale-out': 'scaleOut 0.15s ease-in forwards',
        'tooltip-enter': 'tooltipEnter 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'tooltip-exit': 'tooltipExit 0.15s ease-in forwards',
        'shimmer': 'shimmer 5s infinite linear',
        'section-complete': 'sectionComplete 1s ease-out forwards',
        'flow-up': 'flowUp 40s linear infinite',
        'spin-slow': 'spin 20s linear infinite',
        'float-up': 'floatUp 6s ease-in infinite',
        'bubble-float': 'bubbleFloat 2s ease-in-out infinite',
        'sway': 'sway 3s ease-in-out infinite',
        'sway-slow': 'sway 5s ease-in-out infinite',
        'wiggle': 'wiggle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        slideInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)', pointerEvents: 'none' },
          '100%': { opacity: '1', transform: 'translateY(0)', pointerEvents: 'auto' },
        },
        pop: {
          '0%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        scaleLoop: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        gradient: {
          '0%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
          '100%': { 'background-position': '0% 50%' },
        },
        scan: {
          '0%': { top: '-5%' },
          '100%': { top: '105%' },
        },
        revealPremium: {
          '0%': { transform: 'scale(0.8)', opacity: '0', backgroundColor: '#fffbeb' },
          '40%': { transform: 'scale(1.15)', opacity: '1', backgroundColor: '#fcd34d', boxShadow: '0 0 15px #fbbf24' },
          '100%': { transform: 'scale(1)', opacity: '1', backgroundColor: '#fef3c7', boxShadow: 'none' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'translate(-50%, 10px) scale(0.8)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0) scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'translate(-50%, 0) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, 10px) scale(0.8)' },
        },
        tooltipEnter: {
          '0%': { opacity: '0', transform: 'scale(0)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        tooltipExit: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-150%) skewX(-20deg)' },
          '15%': { transform: 'translateX(150%) skewX(-20deg)' },
          '100%': { transform: 'translateX(150%) skewX(-20deg)' },
        },
        sectionComplete: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '20%': { opacity: '1', transform: 'scale(1)' },
          '70%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1.02)' },
        },
        flowUp: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-50%)' },
        },
        floatUp: {
          '0%': { transform: 'translateY(20px) scale(0.8)', opacity: '0' },
          '10%': { opacity: '0.4' },
          '80%': { opacity: '0.2' },
          '100%': { transform: 'translateY(-120px) scale(1.1)', opacity: '0' },
        },
        bubbleFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' }
        },
        sway: {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' }
        },
        swaySlow: {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' }
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(-2deg) scale(1.02)' },
          '75%': { transform: 'rotate(2deg) scale(0.98)' }
        }
      }
    },
  },
  plugins: [],
  future: {
    hoverOnlyWhenSupported: true,
  },
}