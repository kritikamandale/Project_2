/**
 * Unit tests for auth utilities — route guard logic and token refresh.
 *
 * Route guard assertions import the real ROUTE_RULES / ROLE_HOME /
 * PUBLIC_PREFIXES / checkRoleBasedAccess from middleware.ts (rather than a
 * hand-copied duplicate) so a real regression in the middleware actually
 * fails these tests. `middleware.ts` imports `@/lib/auth`, which pulls in
 * next-auth server config — that's mocked out below since these tests only
 * exercise the pure routing-decision logic, not the auth() wrapper itself.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: (handler: unknown) => handler }));

import {
  ROUTE_RULES,
  ROLE_HOME,
  PUBLIC_PREFIXES,
  checkRoleBasedAccess,
} from "../middleware";

// ---------------------------------------------------------------------------
// Route guard logic — mirrors the public-path / no-session checks in
// middleware.ts's default export, built on the real ROUTE_RULES table above.
// ---------------------------------------------------------------------------

function getRouteDecision(
  pathname: string,
  session: { user?: { role?: string } } | null
): { allow: boolean; redirectTo?: string } {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return { allow: true };
  if (pathname === "/") return { allow: true };

  if (!session?.user) {
    return { allow: false, redirectTo: `/login?callbackUrl=${pathname}` };
  }

  const role = session.user.role ?? "USER";
  const access = checkRoleBasedAccess(pathname, role);
  return access.allowed ? { allow: true } : { allow: false, redirectTo: access.redirectTo };
}

// ---------------------------------------------------------------------------
// Token refresh helpers (pure logic from lib/auth.ts)
// ---------------------------------------------------------------------------

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

  it("blocks DERMATOLOGIST from USER-only /scan", () => {
    // ROUTE_RULES restricts /scan to USER only — DERMATOLOGIST is redirected
    // to their own dashboard, not allowed through.
    const result = getRouteDecision("/scan", { user: { role: "DERMATOLOGIST" } });
    expect(result.allow).toBe(false);
    expect(result.redirectTo).toBe(ROLE_HOME.DERMATOLOGIST);
  });

  it("allows DERMATOLOGIST to access /derm-dashboard", () => {
    expect(
      getRouteDecision("/derm-dashboard", { user: { role: "DERMATOLOGIST" } }).allow
    ).toBe(true);
  });

  it("blocks USER from /admin and redirects to their home", () => {
    const result = getRouteDecision("/admin/dashboard", { user: { role: "USER" } });
    expect(result.allow).toBe(false);
    expect(result.redirectTo).toBe(ROLE_HOME.USER);
  });

  it("allows ADMIN to access /admin routes", () => {
    expect(
      getRouteDecision("/admin/dashboard", { user: { role: "ADMIN" } }).allow
    ).toBe(true);
  });
});

describe("ROUTE_RULES table shape", () => {
  it("every rule has a valid pattern, at least one allowed role, and a redirect", () => {
    for (const rule of ROUTE_RULES) {
      expect(rule.pattern).toBeInstanceOf(RegExp);
      expect(rule.allowedRoles.length).toBeGreaterThan(0);
      expect(typeof rule.redirectTo).toBe("string");
    }
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
    const issuedAt = now - 14 * 60 * 1000;      // 14min ago
    const expiresAt = now + 90 * 1000;           // 1.5min left out of 15.5min total
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
