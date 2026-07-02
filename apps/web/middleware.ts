import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Role → default dashboard mapping
// ---------------------------------------------------------------------------
const ROLE_HOME: Record<string, string> = {
  USER: "/dashboard",
  DERMATOLOGIST: "/derm-dashboard",
};

// ---------------------------------------------------------------------------
// First-time onboarding gate (USER role only)
// A USER must complete the strict 3-step flow before any post-onboarding route
// is reachable. Each status maps to the single onboarding sub-route the user is
// allowed to be on; "completed" unlocks the rest of the app.
// ---------------------------------------------------------------------------
const ONBOARDING_STEP_PATH: Record<string, string> = {
  not_started: "/onboarding/questionnaire",
  questionnaire_done: "/onboarding/scan",
  scan_done: "/onboarding/recommendations",
  completed: "/dashboard",
};

// ---------------------------------------------------------------------------
// Route protection rules (checked in order)
// ---------------------------------------------------------------------------
type RouteRule = {
  pattern: RegExp;
  allowedRoles: string[];
  redirectTo: string; // redirect wrong-role users here
};

const ROUTE_RULES: RouteRule[] = [
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
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/privacy",
  "/terms",
  "/api/auth",
  "/api/proxy",  // proxy handles its own Bearer token auth
  "/api/csrf",
  "/_next",
  "/favicon.ico",
  "/public",
  "/models",
];

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
  for (const rule of ROUTE_RULES) {
    if (rule.pattern.test(pathname)) {
      if (!rule.allowedRoles.includes(userRole)) {
        // Wrong role — redirect to that role's own home
        const home = ROLE_HOME[userRole] ?? rule.redirectTo;
        return NextResponse.redirect(new URL(home, req.url));
      }
      break;
    }
  }

  // First-time onboarding gate — USER role only. DERMATOLOGIST/ADMIN untouched.
  if (userRole === "USER") {
    const onboardingStatus: string =
      (session.user as any).onboardingStatus ?? "not_started";
    const onOnboarding = pathname.startsWith("/onboarding");

    if (onboardingStatus !== "completed") {
      const stepPath = ONBOARDING_STEP_PATH[onboardingStatus] ?? ONBOARDING_STEP_PATH.not_started;
      // Any post-onboarding route → bounce to the current step.
      if (!onOnboarding) {
        return NextResponse.redirect(new URL(stepPath, req.url));
      }
      // Inside onboarding but not on the allowed step → no skipping ahead/back.
      if (pathname !== stepPath) {
        return NextResponse.redirect(new URL(stepPath, req.url));
      }
    } else if (onOnboarding) {
      // Completed users can't re-enter onboarding by URL; re-scans live in the app.
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Attach role / user-id headers for downstream RSC / route handlers
  const response = NextResponse.next();
  response.headers.set("x-user-role", userRole);
  response.headers.set("x-user-id", (session.user as any).id ?? "");
  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|models).*)",
  ],
};
