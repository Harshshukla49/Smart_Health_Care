/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    container: {
      center: false,
      padding: '1rem',
      screens: {
        sm: '100%',
        md: '100%',
        lg: '100%',
        xl: '100%',
        '2xl': '100%',
      },
    },
    extend: {
      fontFamily: {
        body: ['Gadugi', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Bodoni MT', 'Bodoni 72', 'Didot', 'Iowan Old Style', 'Times New Roman', 'serif'],
        sans: ['Gadugi', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Bodoni MT', 'Bodoni 72', 'Didot', 'Iowan Old Style', 'Times New Roman', 'serif'],
      },
      colors: {
        ink: '#08101f',
        panel: 'rgba(15, 23, 42, 0.55)',
        line: 'rgba(148, 163, 184, 0.18)',
      },
      boxShadow: {
        glow: '0 18px 60px rgba(14, 165, 233, 0.16)',
        glass: '0 20px 80px rgba(2, 6, 23, 0.35)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: 0, transform: 'translateX(-18px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.6s ease-out both',
        slideIn: 'slideIn 0.45s ease-out both',
        float: 'float 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
