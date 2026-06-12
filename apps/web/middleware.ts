import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Role → default dashboard mapping
// ---------------------------------------------------------------------------
const ROLE_HOME: Record<string, string> = {
  USER: "/dashboard",
  DERMATOLOGIST: "/derm-dashboard",
  ADMIN: "/admin-dashboard",
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
    pattern: /^\/(scan|questionnaire|results|roadmap|progress)(\/|$)/,
    allowedRoles: ["USER", "DERMATOLOGIST", "ADMIN"],
    redirectTo: "/login",
  },
  // User dashboard (own)
  {
    pattern: /^\/dashboard(\/|$)/,
    allowedRoles: ["USER", "DERMATOLOGIST", "ADMIN"],
    redirectTo: "/login",
  },
  // Dermatologist routes
  {
    pattern: /^\/(derm-dashboard|review-queue|case)(\/|$)/,
    allowedRoles: ["DERMATOLOGIST", "ADMIN"],
    redirectTo: "/dashboard",
  },
  // Admin routes
  {
    pattern: /^\/(admin-dashboard|users|products|analytics|settings)(\/|$)/,
    allowedRoles: ["ADMIN"],
    redirectTo: "/dashboard",
  },
  // Legacy group-prefixed routes (from Phase 1 scaffold)
  {
    pattern: /^\/(user)\//,
    allowedRoles: ["USER", "DERMATOLOGIST", "ADMIN"],
    redirectTo: "/login",
  },
  {
    pattern: /^\/(dermatologist)\//,
    allowedRoles: ["DERMATOLOGIST", "ADMIN"],
    redirectTo: "/dashboard",
  },
  {
    pattern: /^\/(admin)\//,
    allowedRoles: ["ADMIN"],
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
