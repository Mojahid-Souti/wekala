import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      keyframes: {
        "mockup-scene-1": {
          "0%, 30.5%, 100%": { opacity: "1" },
          "33.3%, 97.2%": { opacity: "0" },
        },
        "mockup-scene-2": {
          "0%, 30.5%": { opacity: "0" },
          "33.3%, 63.8%": { opacity: "1" },
          "66.6%, 100%": { opacity: "0" },
        },
        "mockup-scene-3": {
          "0%, 63.8%": { opacity: "0" },
          "66.6%, 97.2%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "mockup-cursor": {
          "0%": { transform: "translate(70%, 60%)", opacity: "0" },
          "5%": { transform: "translate(70%, 60%)", opacity: "1" },
          "15%": { transform: "translate(55%, 40%)", opacity: "1" },
          "25%": { transform: "translate(45%, 65%)", opacity: "1" },
          "33%": { transform: "translate(45%, 65%)", opacity: "0" },
          "40%": { transform: "translate(35%, 75%)", opacity: "1" },
          "55%": { transform: "translate(60%, 80%)", opacity: "1" },
          "66%": { transform: "translate(60%, 80%)", opacity: "0" },
          "75%": { transform: "translate(45%, 20%)", opacity: "1" },
          "90%": { transform: "translate(60%, 25%)", opacity: "1" },
          "100%": { transform: "translate(60%, 25%)", opacity: "0" },
        },
        "mockup-card-pulse": {
          "0%, 12%, 33%, 100%": {
            transform: "translateY(0)",
            boxShadow: "0 0 0 0 rgba(0,0,0,0)",
          },
          "20%, 25%": {
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px -4px rgba(0,0,0,0.25)",
          },
        },
        "mockup-bar-grow": {
          "0%, 34%": { transform: "scaleY(0)" },
          "40%, 65%": { transform: "scaleY(1)" },
          "67%, 100%": { transform: "scaleY(0)" },
        },
        "mockup-tab-highlight": {
          "0%, 67%": { transform: "scaleX(0)", transformOrigin: "left" },
          "73%, 95%": { transform: "scaleX(1)", transformOrigin: "left" },
          "100%": { transform: "scaleX(0)", transformOrigin: "right" },
        },
        "auth-flip-in": {
          "0%": { transform: "rotateY(-90deg)", opacity: "0" },
          "100%": { transform: "rotateY(0deg)", opacity: "1" },
        },
        "auth-fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "otp-caret-blink": {
          "0%, 70%, 100%": { opacity: "1" },
          "20%, 50%": { opacity: "0" },
        },
        "spotlight-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.9" },
          "100%": { transform: "scale(1.25)", opacity: "0" },
        },
        "spotlight-ripple": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "70%": { opacity: "0.2" },
          "100%": { transform: "scale(1.35)", opacity: "0" },
        },
      },
      animation: {
        "mockup-scene-1": "mockup-scene-1 18s ease-in-out infinite",
        "mockup-scene-2": "mockup-scene-2 18s ease-in-out infinite",
        "mockup-scene-3": "mockup-scene-3 18s ease-in-out infinite",
        "mockup-cursor": "mockup-cursor 18s ease-in-out infinite",
        "mockup-card-pulse": "mockup-card-pulse 18s ease-in-out infinite",
        "mockup-bar-grow": "mockup-bar-grow 18s ease-out infinite",
        "mockup-tab-highlight": "mockup-tab-highlight 18s ease-in-out infinite",
        "auth-flip-in": "auth-flip-in 500ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "auth-fade-in": "auth-fade-in 200ms ease-out both",
        "otp-caret-blink": "otp-caret-blink 1.2s ease-in-out infinite",
        "spotlight-pulse": "spotlight-pulse 1.6s cubic-bezier(0, 0, 0.2, 1) infinite",
        "spotlight-ripple": "spotlight-ripple 2.2s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
