/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      colors: {
        monad: '#8B5CF6',
        darkBg: '#0F0F23',
        darkCard: '#1A1A2E',
        darkCardHover: '#252545',
        userBg: '#3B82F6',
        otherBg: '#374151',
        accent: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      keyframes: {
        slideIn: {
            '0%': { transform: 'translateY(20px)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
            '0%': { transform: 'translateX(-20px)', opacity: '0' },
            '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
            '0%': { transform: 'translateX(20px)', opacity: '0' },
            '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
        },
        pulse: {
            '0%, 100%': { opacity: '1' },
            '50%': { opacity: '0.6' },
        },
        bounce: {
          '0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0,0,0)' },
          '40%, 43%': { transform: 'translate3d(0, -30px, 0)' },
          '70%': { transform: 'translate3d(0, -15px, 0)' },
          '90%': { transform: 'translate3d(0, -4px, 0)' },
        },
      },
      animation: {
        slideIn: 'slideIn 0.3s ease-out',
        slideInLeft: 'slideInLeft 0.3s ease-out',
        slideInRight: 'slideInRight 0.3s ease-out',
        fadeIn: 'fadeIn 0.2s ease-out',
        pulse: 'pulse 2s infinite',
        bounce: 'bounce 1s infinite',
      }
    },
  },
  plugins: [],
}