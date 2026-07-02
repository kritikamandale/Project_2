import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        // ─── SkinAI 5-color brand palette ──────────────────────────────
        // eggshell (base bg) · burnt-peach (primary/CTA) · twilight-indigo
        // (text/dark surfaces) · muted-teal (AI/analysis accent) ·
        // apricot-cream (tertiary highlight). Every scale below is a tint/
        // shade ramp DERIVED from one of these five — no hex outside the
        // family is introduced anywhere in this palette.
        eggshell: "#f4f1de",
        "burnt-peach": "#e07a5f",
        "twilight-indigo": "#3d405b",
        "muted-teal": "#81b29a",
        "apricot-cream": "#f2cc8f",

        // Primary/CTA scale — tints & shades of burnt-peach. Replaces the
        // old orange "skin" scale; every existing `skin-*` utility class in
        // the app now renders in the new brand color automatically.
        skin: {
          50: "#fdf7f5",
          100: "#fbece9",
          200: "#f6d7cf",
          300: "#f0bcaf",
          400: "#e89b87",
          500: "#e07a5f", // burnt-peach, exact
          600: "#be6851", // hover/active — darkened, not a new hue
          700: "#985341",
          800: "#743f31",
          900: "#552e24",
        },
        // AI / analysis / medical accent scale — tints & shades of
        // muted-teal. Score dials, confidence bars, Fitzpatrick indicators,
        // "AI-powered" badges route through this scale.
        teal: {
          50: "#f7faf9",
          100: "#edf4f1",
          200: "#d9e8e1",
          300: "#c0d8cc",
          400: "#a0c5b3",
          500: "#81b29a", // muted-teal, exact
          600: "#6e9783",
          700: "#587969",
          800: "#435d50",
          900: "#31443b",
        },
        // Tertiary highlight scale — tints & shades of apricot-cream, for
        // chips, hover fills, dividers, tags. Used as a small fill, not a
        // large surface (it gets muddy at scale — see role-mapping notes).
        cream: {
          50: "#fefcf8",
          100: "#fdf8ef",
          200: "#fbf0dd",
          300: "#f8e6c7",
          400: "#f5d9ab",
          500: "#f2cc8f", // apricot-cream, exact
          600: "#cead7a",
          700: "#a58b61",
          800: "#7e6a4a",
          900: "#5c4e36",
        },
        // Neutral scale — NOT generic gray. Every shade is a tint/shade of
        // twilight-indigo, so borders/dividers/muted text/disabled states
        // stay inside the five-color family instead of leaking a neutral
        // gray that fights the palette. Overriding Tailwind's default
        // `gray`/`zinc` here means every existing gray-*/zinc-* utility
        // class already in the app picks this up automatically.
        gray: {
          50: "#f3f4f5",
          100: "#e4e4e8",
          200: "#c5c6ce",
          300: "#9ea0ad",
          400: "#6e7084",
          500: "#3d405b", // twilight-indigo, exact
          600: "#34364d",
          700: "#292c3e",
          800: "#20212f",
          900: "#171823",
        },
        zinc: {
          50: "#f3f4f5",
          100: "#e4e4e8",
          200: "#c5c6ce",
          300: "#9ea0ad",
          400: "#6e7084",
          500: "#3d405b",
          600: "#34364d",
          700: "#292c3e",
          800: "#20212f",
          900: "#171823",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // Body — default reading text everywhere (paragraphs, descriptions,
        // form labels, questionnaire copy). Applied at the document root, so
        // any element without an explicit font-* override inherits this.
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        body: ["var(--font-manrope)", "system-ui", "sans-serif"],
        // Hero headings, subheadings, and large AI-output numbers (skin
        // score, confidence %, severity) all share Space Grotesk — the role
        // (hero/subheading/number) is distinguished by font-weight utility
        // (font-bold=700 for hero+numbers, font-medium=500 for subheadings),
        // not by a separate family.
        heading: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        number: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        // Buttons — all CTAs, form submits, nav actions app-wide.
        button: ["var(--font-sora)", "system-ui", "sans-serif"],
        // Product recommendation cards — name, brand, ingredient text.
        card: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scan-line": {
          "0%, 100%": { transform: "translateY(0%)" },
          "50%": { transform: "translateY(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "scan-line": "scan-line 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
