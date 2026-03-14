/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1e3a8a',
        'primary-light': '#3b82f6',
        'primary-dark': '#0f172a',
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
        },
      },
      borderRadius: {
        xl: '16px',
        '2xl': '24px',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'DM Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'ui-sans-serif'],
      },
    }
  },
  plugins: []
}
