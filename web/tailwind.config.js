/** @type {import('tailwindcss').Config} */
// Zine design tokens per ROADMAP Section 13. UI-Zine agent territory.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zine: {
          mint: '#98D9C2',
          periwinkle: '#8B9FD4',
          cream: '#F5F5DC',
          burntYellow: '#E8A42C',
          burntOrange: '#D97642',
        },
      },
      fontFamily: {
        display: ['"Alfa Slab One"', 'Georgia', 'serif'],
        body: ['Bitter', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
