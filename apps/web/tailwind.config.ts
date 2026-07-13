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
        // `hsl(var(--x) / <alpha-value>)` (not plain `hsl(var(--x))`) so that
        // opacity utilities like `bg-card/50` work — required for glass
        // surfaces built from these semantic tokens directly.
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        // ─── "Aqua Glass" brand palette ──────────────────────────────────
        // Pearl White → Sky-Blue background gradient · Aqua Blue (CTA) ·
        // Deep Teal (headers/secondary) · Pearlescent shimmer (glass glare) ·
        // Ocean Navy (text). Every scale below is a tint/shade ramp DERIVED
        // from one of these six — no hex outside the family is introduced
        // anywhere in this palette.
        "aquaglass-bg-start": "#F7F9FA",
        "aquaglass-bg-end": "#DCEFF5",
        "aquaglass-accent": "#7FC4DD",
        "aquaglass-accent-dark": "#3E7C93",
        "aquaglass-shimmer": "#EDF4F6",
        "aquaglass-navy": "#1F3A47",

        // Primary/CTA scale — tints & shades of Aqua Blue. Replaces the old
        // burnt-peach "skin" scale; every existing `skin-*` utility class in
        // the app now renders in the new Aqua Glass brand color automatically.
        skin: {
          50: "#f4fbfd",
          100: "#e6f5fa",
          200: "#cceaf5",
          300: "#abdbec",
          400: "#8ecfe2",
          500: "#7fc4dd", // aquaglass-accent, exact
          600: "#5aa8c4", // hover/active — darkened, not a new hue
          700: "#4589a3",
          800: "#396f83",
          900: "#2c5563",
        },
        // AI / analysis / medical accent scale — tints & shades of Deep
        // Teal. Score dials, confidence bars, Fitzpatrick indicators,
        // "AI-powered" badges, and section headers route through this scale.
        teal: {
          50: "#eff6f8",
          100: "#dceef2",
          200: "#b9dce5",
          300: "#8fc2d2",
          400: "#5f9fb3",
          500: "#3e7c93", // aquaglass-accent-dark, exact
          600: "#35697d",
          700: "#2c5666",
          800: "#234350",
          900: "#1a323c",
        },
        // Tertiary highlight scale — tints & shades of the pearlescent
        // shimmer, for chips, hover fills, dividers, glass-surface glares.
        // Used as a small fill/accent, not a large surface.
        cream: {
          50: "#fefeff",
          100: "#fcfeff",
          200: "#f8fbfd",
          300: "#f2f8fa",
          400: "#f0f6f8",
          500: "#edf4f6", // aquaglass-shimmer, exact
          600: "#c9dde3",
          700: "#a3c1cb",
          800: "#7ba2b0",
          900: "#547f8f",
        },
        // Neutral scale — NOT generic gray. Every shade is a tint/shade of
        // Deep Ocean Navy, so borders/dividers/muted text/disabled states
        // stay inside the Aqua Glass family instead of leaking a neutral
        // gray that fights the palette. Overriding Tailwind's default
        // `gray`/`zinc` here means every existing gray-*/zinc-* utility
        // class already in the app picks this up automatically.
        gray: {
          50: "#eef2f4",
          100: "#dce4e8",
          200: "#b8c9d0",
          300: "#8fa9b3",
          400: "#5c7e8c",
          500: "#1f3a47", // aquaglass-navy, exact
          600: "#1b323d",
          700: "#162933",
          800: "#112028",
          900: "#0c161b",
        },
        zinc: {
          50: "#eef2f4",
          100: "#dce4e8",
          200: "#b8c9d0",
          300: "#8fa9b3",
          400: "#5c7e8c",
          500: "#1f3a47",
          600: "#1b323d",
          700: "#162933",
          800: "#112028",
          900: "#0c161b",
        },
      },
      boxShadow: {
        // Soft "ocean" shadows for floating glass panels — diffuse, tinted
        // navy instead of pure black so panels read as submerged/afloat
        // rather than paper-cut-out.
        glass: "0 8px 32px rgba(31, 58, 71, 0.05)",
        "glass-md": "0 12px 40px rgba(31, 58, 71, 0.08)",
        "glass-lg": "0 20px 60px rgba(31, 58, 71, 0.12)",
        // Glow shadow for active/focus/hover states on aqua-accented controls.
        water: "0 4px 24px rgba(127, 196, 221, 0.35)",
      },
      backdropBlur: {
        // Semantic alias for the standard glass-card blur (== Tailwind's
        // default `lg` step of 16px) so glass surfaces read intent, not magnitude.
        glass: "16px",
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
