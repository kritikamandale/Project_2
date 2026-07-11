/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

// Routes that need camera access (Permissions-Policy: camera=self).
// Both the standalone re-scan route and the first-time onboarding scan step.
const SCAN_ROUTES = ["/scan", "/onboarding/scan"];

// Trusted script sources — unsafe-eval only on scan page (TF.js requirement)
const BASE_CSP = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Sentry, PostHog, Vercel analytics — the AI recommendation engine is called
  // server-side only (via the backend proxy), so no external AI host needs to
  // be allowed here.
  "connect-src 'self' https://*.sentry.io https://app.posthog.com",
  "worker-src blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

// Dev mode needs unsafe-eval for hot reloading / source maps; production drops it
const IS_DEV = process.env.NODE_ENV !== "production";

// The browser calls the FastAPI backend directly (register, scan submit, …),
// so its origin must be in connect-src in EVERY environment — production too.
// Previously this was dev-only, which broke all API calls from a `next start`
// or deployed build with "Refused to connect … Content Security Policy".
const API_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").origin;
  } catch {
    return "http://localhost:8000";
  }
})();

// In dev additionally allow the backend websocket and the app itself (HMR,
// NextAuth redirects, internal fetches).
const CONNECT_SRC_EXTRA = IS_DEV
  ? ` ${API_ORIGIN} ws://localhost:8000 ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}`
  : ` ${API_ORIGIN}`;

const SCAN_SCRIPT_SRC = "script-src 'self' 'unsafe-eval' 'unsafe-inline'"; // TF.js needs unsafe-eval
const DEFAULT_SCRIPT_SRC = IS_DEV
  ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"  // needed by Next.js HMR
  : "script-src 'self' 'unsafe-inline'";

function buildCSP(isScanRoute) {
  const base = BASE_CSP.map((directive) =>
    directive.startsWith("connect-src ")
      ? directive + CONNECT_SRC_EXTRA
      : directive
  );
  return [
    ...base,
    isScanRoute ? SCAN_SCRIPT_SRC : DEFAULT_SCRIPT_SRC,
  ].join("; ");
}

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,  // Remove X-Powered-By: Next.js

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "assets.nykaa.com" },
      { protocol: "https", hostname: "cdn.dermaco.in" },
      { protocol: "https", hostname: "cdn.theordinary.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      // TODO: replace with real customer photography — placeholder headshot
      // source for the expanded social-proof avatar cluster (see app/page.tsx).
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },

  // Proxy API calls to FastAPI backend to avoid CORS in dev
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`,
      },
    ];
  },

  async headers() {
    return [
      // =======================================================================
      // /scan and /onboarding/scan — camera access enabled, TF.js unsafe-eval allowed
      // =======================================================================
      ...SCAN_ROUTES.map((source) => ({
        source,
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera permitted only on the scan pages
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: buildCSP(true) },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      })),
      // =======================================================================
      // All other routes — camera blocked, stricter CSP
      // =======================================================================
      {
        source: "/((?!scan(?:/|$)|onboarding/scan(?:/|$)).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: buildCSP(false) },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Prevent browsers auto-completing sensitive admin forms
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },

  experimental: {
    serverComponentsExternalPackages: ["sharp"],
    // Speed up dev/prod compilation: transform barrel imports from these heavy
    // libraries into direct deep imports so Next only compiles the icons/exports
    // actually used, instead of the whole package. Big win for on-demand dev
    // compile times (lucide-react + framer-motion are used on nearly every page).
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

// Opt-in escape hatch: skip the Sentry webpack plugin (source-map generation is
// memory-heavy) on constrained machines. Does not affect app runtime behaviour.
module.exports = process.env.DISABLE_SENTRY === "1"
  ? nextConfig
  : withSentryConfig(nextConfig, {
      silent: true,
      hideSourceMaps: true,
    });
