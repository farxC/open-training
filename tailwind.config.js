const palette = require("./src/theme/palette.json");
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Carmine actions, neutral surfaces and semantic status colors.
        brand: {
          100: palette.pale,
          200: palette.line,
          300: palette.faint,
          400: palette.muted,
          500: palette.primary,
          600: palette.primaryHover,
          700: "#141210",
          800: "#0e0d0b",
          900: "#000000",
        },
        surface: {
          DEFAULT: palette.paper,
          card: palette.white,
          elevated: palette.sidebar,
          border: palette.line,
        },
        // ink = text scale (warm near-black → faint)
        ink: {
          DEFAULT: palette.ink,
          soft: palette.muted,
          mute: palette.muted,
          faint: palette.faint,
        },
        accent: {
          green: palette.success,
          amber: palette.record,
          red: palette.danger,
        },
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "system-ui", "-apple-system", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
        data: ["JetBrains Mono", "Menlo", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};
