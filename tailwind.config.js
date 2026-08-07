/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#0a0e14",
          900: "#0f141b",
          850: "#131a23",
          800: "#171f2a",
          700: "#212c3a",
          600: "#2c3a4a",
        },
        accent: {
          green: "#22c55e",
          emerald: "#10b981",
          blue: "#3b82f6",
          cyan: "#06b6d4",
        },
        warn: "#f59e0b",
        danger: "#ef4444",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.24), 0 8px 24px -8px rgba(0,0,0,0.45)",
        glow: "0 0 0 1px rgba(34,197,94,0.15), 0 8px 30px -8px rgba(34,197,94,0.25)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
