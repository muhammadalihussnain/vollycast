/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:  '#0f172a',
          panel: '#1e293b',
          card:  '#334155',
          accent: '#38bdf8',
          live:  '#ef4444',
          warn:  '#f59e0b',
          ok:    '#22c55e',
        },
      },
    },
  },
  plugins: [],
};
