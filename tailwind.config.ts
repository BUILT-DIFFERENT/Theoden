import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Instrument Sans", "sans-serif"]
      },
      colors: {
        ink: {
          50: "#f6f8fb",
          100: "#e4e9f0",
          200: "#c9d2df",
          300: "#9fb0c8",
          400: "#5a6b82",
          500: "#3a4658",
          600: "#273141",
          700: "#1a2230",
          800: "#121723",
          900: "#0d1117"
        },
        flare: {
          100: "#ffe8d1",
          200: "#ffc58a",
          300: "#ff9b4a",
          400: "#ff7a1a",
          500: "#f05c00"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255, 155, 74, 0.2), 0 12px 32px rgba(26, 32, 43, 0.35)",
        card: "0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 32px rgba(26, 32, 43, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;
