/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Voice-orb (V3) animations. Listening/speaking reuse built-in
      // animate-ping / animate-pulse; idle + thinking use these.
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        breathe: "breathe 3s ease-in-out infinite",
        "spin-slow": "spin-slow 3.5s linear infinite",
      // `font-arabic` utility for opt-in Arabic typography. Resolves to the
      // --font-arabic stack defined in src/index.css (single source of truth).
      fontFamily: {
        arabic: ["var(--font-arabic)"],
      },
    },
  },
  plugins: [],
};
