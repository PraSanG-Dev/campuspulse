/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // CampusPulse brand palette — used consistently everywhere
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // primary
          600: '#4f46e5', // primary dark (hover states)
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        surface: {
          // Neutral surfaces — avoids harsh pure-white / pure-black
          DEFAULT: '#f9fafb', // page background
          card:    '#ffffff', // card background
          border:  '#e5e7eb', // subtle borders
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
