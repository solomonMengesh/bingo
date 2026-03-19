/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'current-ball-attract': 'current-ball-attract 2s ease-in-out infinite',
        'coin-pulse': 'coin-pulse 2s ease-in-out infinite',
        'live-dot': 'live-dot 1.2s ease-in-out infinite',
      },
      keyframes: {
        'current-ball-attract': {
          '0%, 100%': {
            transform: 'scale(1)',
            boxShadow: '0 0 12px 2px rgba(255, 255, 255, 0.5), 0 0 0 0 rgba(251, 191, 36, 0.4)',
          },
          '50%': {
            transform: 'scale(1.15)',
            boxShadow: '0 0 24px 6px rgba(255, 255, 255, 0.9), 0 0 32px 8px rgba(251, 191, 36, 0.5)',
          },
        },
        'coin-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.08)' },
        },
        'live-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.2)' },
        },
      },
      colors: {
        bingoPurple: '#4C1D95',
        bingoPink: '#EC4899',
        bingoGold: '#FBBF24',
        bingoDark: '#020617',
        deepSpace: '#0B0E14',
        cardSurface: '#161B22',
        neonCyan: '#22D3EE',
        neonRose: '#FB7185',
      },
      boxShadow: {
        'bingo-card': '0 20px 40px rgba(15,23,42,0.6)',
        'glow-cyan': '0 0 12px rgba(34, 211, 238, 0.4), inset 0 0 0 1px rgba(34, 211, 238, 0.2)',
        'glow-rose': '0 0 12px rgba(251, 113, 133, 0.4), inset 0 0 0 1px rgba(251, 113, 133, 0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

