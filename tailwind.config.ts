import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"]
      },
      colors: {
        ink: {
          50: "#f4f6f8",
          100: "#e6e9ef",
          200: "#c6cedb",
          300: "#a2adbf",
          400: "#7b8aa2",
          500: "#5f6e86",
          600: "#4a586d",
          700: "#3b4758",
          800: "#2a323f",
          900: "#1a202b"
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
