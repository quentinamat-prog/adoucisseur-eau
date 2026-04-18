import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        terracotta: '#934215',
        beige: '#F0E8D9',
        sage: '#A9B199',
        teal: '#114550',
        dark: '#061E23',
        cream: '#FDF8F5',
      },
      fontFamily: {
        display: ['Ciguatera', 'Georgia', 'serif'],
        script: ['Brittany Signature', 'Dancing Script', 'cursive'],
        body: ['Dosis', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
};
