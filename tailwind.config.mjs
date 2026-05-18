import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        terracotta: '#1A96B4',
        beige: '#E6F3F7',
        sage: '#7BAFC2',
        teal: '#0D5E77',
        dark: '#0A1E2C',
        cream: '#F5FBFD',
      },
      fontFamily: {
        display: ['Dosis', 'system-ui', 'sans-serif'],
        body: ['Dosis', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
};
