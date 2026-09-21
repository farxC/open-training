const plugin = require("tailwindcss/plugin");
const { light, dark, CLASS_TOKENS } = require("./src/theme/palette");

/**
 * "#f4f2ee" → "244 242 238".
 *
 * Space-separated channels rather than the hex itself, because that is the form
 * the native runtime can actually take apart: react-native-css-interop's
 * getColorArgs (runtime/native/resolve-value.js) splits each argument on
 * /[,\s\/]/, so `rgb(var(--color-surface) / 1)` becomes four args and resolves
 * to rgba(244, 242, 238, 1). A hex inside var() never reaches that path.
 */
function toChannels(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
}

function varsFor(palette) {
  return Object.fromEntries(
    CLASS_TOKENS.map((token) => [`--color-${token}`, toChannels(palette[token])])
  );
}

/** `surface-card` → the class color `rgb(var(--color-surface-card) / <alpha-value>)`. */
function ref(token) {
  return `rgb(var(--color-${token}) / <alpha-value>)`;
}

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Must be "class", not "media": react-native-css-interop's web colorScheme.set()
  // throws outright under "media", so the user could never pick a theme in the
  // browser. NOTE: this flag is baked into the compiled CSS, so changing it
  // requires `npx expo start -c` — a stale Metro cache reports the old value.
  darkMode: "class",
  theme: {
    extend: {
      // Every color points at a CSS variable instead of a literal, so a single
      // class (`bg-surface`) resolves per scheme and the ~425 existing class
      // usages became theme-aware without a single call-site edit.
      colors: {
        surface: {
          DEFAULT: ref("surface"),
          card: ref("surface-card"),
          elevated: ref("surface-elevated"),
          raised: ref("surface-raised"),
          tint: ref("surface-tint"),
          border: ref("surface-border"),
          "border-strong": ref("surface-border-strong"),
        },
        ink: {
          DEFAULT: ref("ink"),
          soft: ref("ink-soft"),
          mute: ref("ink-mute"),
          faint: ref("ink-faint"),
        },
        brand: {
          100: ref("brand-100"),
          200: ref("brand-200"),
          300: ref("brand-300"),
          400: ref("brand-400"),
          500: ref("brand-500"),
          600: ref("brand-600"),
          900: ref("brand-900"),
          ink: ref("brand-ink"),
        },
        accent: {
          green: ref("accent-green"),
          "green-soft": ref("accent-green-soft"),
          "green-ink": ref("accent-green-ink"),
          amber: ref("accent-amber"),
          "amber-soft": ref("accent-amber-soft"),
          "amber-ink": ref("accent-amber-ink"),
          red: ref("accent-red"),
          "red-soft": ref("accent-red-soft"),
          "red-ink": ref("accent-red-ink"),
        },
        gold: { DEFAULT: ref("gold"), soft: ref("gold-soft"), ink: ref("gold-ink") },
        pewter: { DEFAULT: ref("pewter"), soft: ref("pewter-soft"), ink: ref("pewter-ink") },
        copper: { DEFAULT: ref("copper"), soft: ref("copper-soft"), ink: ref("copper-ink") },
        dot: {
          musculacao: ref("dot-musculacao"),
          corrida: ref("dot-corrida"),
          ciclismo: ref("dot-ciclismo"),
          natacao: ref("dot-natacao"),
          caminhada: ref("dot-caminhada"),
        },
        shadow: ref("shadow"),
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "system-ui", "-apple-system", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
        data: ["JetBrains Mono", "Menlo", "Courier New", "monospace"],
      },
    },
  },
  plugins: [
    // `.dark:root` — the exact pair css-to-rn/normalize-selectors.js matches to
    // tag these as the dark variable set. `.dark :root` or `:root.dark` do not
    // register, and the vars silently stay light on native.
    plugin(({ addBase }) => {
      addBase({ ":root": varsFor(light), ".dark:root": varsFor(dark) });
    }),
  ],
};
