import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Role → default dashboard mapping
// Exported so unit tests exercise this real table instead of a hand-copied
// duplicate that silently drifts out of sync (see __tests__/auth.test.ts).
// ---------------------------------------------------------------------------
export const ROLE_HOME: Record<string, string> = {
  USER: "/dashboard",
  DERMATOLOGIST: "/derm-dashboard",
  ADMIN: "/admin/dashboard",
};

// ---------------------------------------------------------------------------
// First-time onboarding gate (USER role only)
// A USER must complete the strict 3-step flow before any post-onboarding route
// is reachable. Each status maps to the single onboarding sub-route the user is
// allowed to be on; "completed" unlocks the rest of the app.
// ---------------------------------------------------------------------------
export const ONBOARDING_STEP_PATH: Record<string, string> = {
  not_started: "/onboarding/questionnaire",
  questionnaire_done: "/onboarding/scan",
  scan_done: "/onboarding/recommendations",
  completed: "/dashboard",
};

// ---------------------------------------------------------------------------
// Route protection rules (checked in order)
// ---------------------------------------------------------------------------
export type RouteRule = {
  pattern: RegExp;
  allowedRoles: string[];
  redirectTo: string; // redirect wrong-role users here
};

export const ROUTE_RULES: RouteRule[] = [
  // User routes
  {
    pattern: /^\/(scan|questionnaire|results|roadmap|progress|profile|onboarding|history)(\/|$)/,
    allowedRoles: ["USER"],
    redirectTo: "/login",
  },
  // User dashboard (own)
  {
    pattern: /^\/dashboard(\/|$)/,
    allowedRoles: ["USER", "DERMATOLOGIST"],
    redirectTo: "/login",
  },
  // Dermatologist routes
  {
    pattern: /^\/(derm-dashboard|review-queue|case)(\/|$)/,
    allowedRoles: ["DERMATOLOGIST"],
    redirectTo: "/dashboard",
  },
  // Admin routes
  {
    pattern: /^\/admin(\/|$)/,
    allowedRoles: ["ADMIN"],
    redirectTo: "/dashboard",
  },
  // Legacy group-prefixed routes (from Phase 1 scaffold)
  {
    pattern: /^\/(user)\//,
    allowedRoles: ["USER", "DERMATOLOGIST"],
    redirectTo: "/login",
  },
  {
    pattern: /^\/(dermatologist)\//,
    allowedRoles: ["DERMATOLOGIST"],
    redirectTo: "/dashboard",
  },
];

// Public paths — skip auth entirely
export const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/privacy",
  "/terms",
  "/api/auth",
  "/api/proxy", // proxy handles its own Bearer token auth + Origin CSRF check
  "/_next",
  "/favicon.ico",
  "/public",
  "/models",
  "/images",
];

// ---------------------------------------------------------------------------
// Pure role-based route decision — extracted so it can be unit-tested
// directly instead of via a hand-maintained copy of this logic.
// ---------------------------------------------------------------------------
export function checkRoleBasedAccess(
  pathname: string,
  userRole: string
): { allowed: boolean; redirectTo?: string } {
  for (const rule of ROUTE_RULES) {
    if (rule.pattern.test(pathname)) {
      if (!rule.allowedRoles.includes(userRole)) {
        const home = ROLE_HOME[userRole] ?? rule.redirectTo;
        return { allowed: false, redirectTo: home };
      }
      break;
    }
  }
  return { allowed: true };
}

export default auth((req: NextRequest & { auth: any }) => {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Root landing page is public
  if (pathname === "/") {
    return NextResponse.next();
  }

  const session = req.auth;

  // No session — redirect to login with callbackUrl
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Refresh error — force re-login
  if ((session as any).error === "RefreshAccessTokenError") {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "SessionExpired");
    return NextResponse.redirect(loginUrl);
  }

  const userRole: string = (session.user as any).role ?? "USER";

  // Check role-based access for each matching rule
  const access = checkRoleBasedAccess(pathname, userRole);
  if (!access.allowed) {
    return NextResponse.redirect(new URL(access.redirectTo!, req.url));
  }

  // First-time onboarding gate for regular USER accounts:
  // Redirect un-onboarded users accessing /dashboard directly to their active step.
  if (userRole === "USER") {
    const onboardingStatus: string = (session.user as any).onboardingStatus ?? "not_started";
    if (onboardingStatus !== "completed") {
      const activeStep = ONBOARDING_STEP_PATH[onboardingStatus] ?? "/onboarding/questionnaire";
      if (pathname === "/dashboard") {
        return NextResponse.redirect(new URL(activeStep, req.url));
      }
    }
  }

  // Forward role / user-id to downstream RSC / route handlers on the REQUEST
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-role", userRole);
  requestHeaders.set("x-user-id", (session.user as any).id ?? "");
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|models).*)",
  ],
};
