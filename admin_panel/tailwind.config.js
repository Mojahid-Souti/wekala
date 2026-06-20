/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // `font-arabic` utility for opt-in Arabic typography. Resolves to the
      // --font-arabic stack defined in src/index.css (single source of truth).
      fontFamily: {
        arabic: ["var(--font-arabic)"],
      },
    },
  },
  plugins: [],
};
