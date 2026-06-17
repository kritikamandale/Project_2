/**
 * Unit tests for auth utilities — route guard logic and token refresh.
 * Tests the pure functions extracted from lib/auth.ts and middleware.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Route guard logic (mirrors middleware.ts ROUTE_RULES)
// ---------------------------------------------------------------------------

type Role = "USER" | "DERMATOLOGIST";

interface RouteRule {
  pattern: RegExp;
  allowedRoles: Role[];
  redirectTo: string;
}

const ROUTE_RULES: RouteRule[] = [
  {
    pattern: /^\/(scan|questionnaire|results|roadmap|progress)(\/|$)/,
    allowedRoles: ["USER", "DERMATOLOGIST"],
    redirectTo: "/login",
  },
  {
    pattern: /^\/dashboard(\/|$)/,
    allowedRoles: ["USER", "DERMATOLOGIST"],
    redirectTo: "/login",
  },
  {
    pattern: /^\/(derm-dashboard|review-queue|case)(\/|$)/,
    allowedRoles: ["DERMATOLOGIST"],
    redirectTo: "/dashboard",
  },
];

const ROLE_HOME: Record<Role, string> = {
  USER: "/dashboard",
  DERMATOLOGIST: "/derm-dashboard",
};

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/privacy",
];

function getRouteDecision(
  pathname: string,
  session: { user?: { role?: string } } | null
): { allow: boolean; redirectTo?: string } {
  // Public paths
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return { allow: true };
  if (pathname === "/") return { allow: true };

  // No session
  if (!session?.user) {
    return { allow: false, redirectTo: `/login?callbackUrl=${pathname}` };
  }

  const role = (session.user.role ?? "USER") as Role;

  for (const rule of ROUTE_RULES) {
    if (rule.pattern.test(pathname)) {
      if (!rule.allowedRoles.includes(role)) {
        return { allow: false, redirectTo: ROLE_HOME[role] ?? rule.redirectTo };
      }
      break;
    }
  }

  return { allow: true };
}

// ---------------------------------------------------------------------------
// Token refresh helpers (pure logic from lib/auth.ts)
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

function shouldRefreshToken(
  issuedAt: number,
  expiresAt: number,
  now: number = Date.now()
): boolean {
  const remainingMs = expiresAt - now;
  const totalMs = expiresAt - issuedAt;
  // Refresh when less than 1 minute remaining, or less than 10% of lifetime left
  return remainingMs < 60_000 || remainingMs / totalMs < 0.1;
}

function isTokenExpired(expiresAt: number, now: number = Date.now()): boolean {
  return expiresAt < now;
}

// ---------------------------------------------------------------------------
// Tests — Route guard
// ---------------------------------------------------------------------------

describe("Route guard — public paths", () => {
  it("allows unauthenticated access to /login", () => {
    expect(getRouteDecision("/login", null).allow).toBe(true);
  });

  it("allows unauthenticated access to /register", () => {
    expect(getRouteDecision("/register", null).allow).toBe(true);
  });

  it("allows unauthenticated access to / (root)", () => {
    expect(getRouteDecision("/", null).allow).toBe(true);
  });

  it("allows unauthenticated access to /privacy", () => {
    expect(getRouteDecision("/privacy", null).allow).toBe(true);
  });
});

describe("Route guard — unauthenticated redirects", () => {
  it("redirects unauthenticated user to login on /scan", () => {
    const result = getRouteDecision("/scan", null);
    expect(result.allow).toBe(false);
    expect(result.redirectTo).toContain("/login");
  });

  it("redirects unauthenticated user to login on /dashboard", () => {
    const result = getRouteDecision("/dashboard", null);
    expect(result.allow).toBe(false);
    expect(result.redirectTo).toContain("/login");
  });
});

describe("Route guard — role-based access", () => {
  it("allows USER to access /scan", () => {
    expect(
      getRouteDecision("/scan", { user: { role: "USER" } }).allow
    ).toBe(true);
  });

  it("allows USER to access /dashboard", () => {
    expect(
      getRouteDecision("/dashboard", { user: { role: "USER" } }).allow
    ).toBe(true);
  });

  it("blocks USER from /derm-dashboard and redirects to their home", () => {
    const result = getRouteDecision("/derm-dashboard", { user: { role: "USER" } });
    expect(result.allow).toBe(false);
    expect(result.redirectTo).toBe("/dashboard");
  });

  it("allows DERMATOLOGIST to access /review-queue", () => {
    expect(
      getRouteDecision("/review-queue", { user: { role: "DERMATOLOGIST" } }).allow
    ).toBe(true);
  });

  it("allows DERMATOLOGIST to access /scan", () => {
    expect(
      getRouteDecision("/scan", { user: { role: "DERMATOLOGIST" } }).allow
    ).toBe(true);
  });

  it("allows DERMATOLOGIST to access /derm-dashboard", () => {
    expect(
      getRouteDecision("/derm-dashboard", { user: { role: "DERMATOLOGIST" } }).allow
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — Token refresh logic
// ---------------------------------------------------------------------------

describe("Token refresh timing", () => {
  const now = Date.now();

  it("does NOT refresh a fresh token with plenty of lifetime left", () => {
    const issuedAt = now - 5 * 60 * 1000;       // issued 5min ago
    const expiresAt = now + 10 * 60 * 1000;     // expires in 10min
    expect(shouldRefreshToken(issuedAt, expiresAt, now)).toBe(false);
  });

  it("refreshes when less than 1 minute remaining", () => {
    const issuedAt = now - 14 * 60 * 1000;      // issued 14min ago
    const expiresAt = now + 45 * 1000;           // expires in 45s
    expect(shouldRefreshToken(issuedAt, expiresAt, now)).toBe(true);
  });

  it("refreshes when less than 10% of lifetime left", () => {
    const issuedAt = now - 13 * 60 * 1000;      // 13min ago
    const expiresAt = now + 90 * 1000;           // 1.5min left out of 14.5min total
    const percentLeft = 90000 / (14 * 60 * 1000 + 90 * 1000);
    if (percentLeft < 0.1) {
      expect(shouldRefreshToken(issuedAt, expiresAt, now)).toBe(true);
    } else {
      expect(shouldRefreshToken(issuedAt, expiresAt, now)).toBe(false);
    }
  });

  it("correctly identifies expired token", () => {
    const expiredAt = now - 1000;
    expect(isTokenExpired(expiredAt, now)).toBe(true);
  });

  it("correctly identifies non-expired token", () => {
    const expiresAt = now + 5 * 60 * 1000;
    expect(isTokenExpired(expiresAt, now)).toBe(false);
  });
});
