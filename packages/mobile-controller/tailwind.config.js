/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mc: {
          bg:     '#0f172a',
          card:   '#1e293b',
          btn:    '#334155',
          home:   '#ef4444',
          away:   '#3b82f6',
          accent: '#38bdf8',
          ok:     '#22c55e',
          warn:   '#f59e0b',
        },
      },
    },
  },
  plugins: [],
};
