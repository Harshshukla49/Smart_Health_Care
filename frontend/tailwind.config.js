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
        body: ['Inter', 'Manrope', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'Manrope', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Manrope', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter', 'Manrope', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0f172a',
        panel: '#ffffff',
        line: '#e2e8f0',
        medical: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      boxShadow: {
        glow: '0 8px 25px rgba(2, 132, 199, 0.12)',
        glass: '0 4px 20px rgba(15, 23, 42, 0.04)',
        medical: '0 4px 20px rgba(15, 23, 42, 0.04)',
        'medical-hover': '0 10px 30px rgba(15, 23, 42, 0.07)',
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
