/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // brand = dark-ink fills (buttons, badges) on the light theme
        brand: {
          100: "#e7e4dc",
          200: "#cfcabf",
          300: "#a8a293",
          400: "#6f6b5f",
          500: "#26241f",
          600: "#1a1815",
          700: "#141210",
          800: "#0e0d0b",
          900: "#000000",
        },
        surface: {
          DEFAULT: "#f4f2ee",
          card: "#ffffff",
          elevated: "#ebe7df",
          border: "#ddd8ce",
        },
        // ink = text scale (warm near-black → faint)
        ink: {
          DEFAULT: "#26241f",
          soft: "#5c594f",
          mute: "#928d80",
          faint: "#bdb8aa",
        },
        accent: {
          green: "#2f9e6e",
          amber: "#b9791f",
          red: "#bf3b30",
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
