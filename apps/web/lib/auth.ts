/**
 * NextAuth.js v5 configuration.
 *
 * Strategy:
 *  - Access token lives in the JWT session token (memory only — never localStorage).
 *  - Refresh token is stored inside the NextAuth JWT cookie (httpOnly, Secure, SameSite=Lax).
 *  - The JWT callback silently refreshes the access token when it's within 60s of expiry.
 *  - The session callback exposes only what the client needs (no refresh token in session).
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// ---------------------------------------------------------------------------
// Token refresh helper (server-side only)
// ---------------------------------------------------------------------------

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
  error?: never;
} | { error: string }> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "RefreshFailed");
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpires: Date.now() + 14 * 60 * 1000, // 14 min (1 min before 15-min expiry)
    };
  } catch (err) {
    return { error: (err as Error).message ?? "RefreshAccessTokenError" };
  }
}

// ---------------------------------------------------------------------------
// NextAuth config
// ---------------------------------------------------------------------------

const authConfig: NextAuthConfig = {
  // Required when running `next start` locally / behind a reverse proxy —
  // dev mode auto-trusts the host, production does not (UntrustedHost error).
  // Vercel sets this automatically; self-hosted deployments rely on this flag.
  trustHost: true,

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        try {
          const res = await fetch(`${API_URL}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
          });

          if (!res.ok) {
            // Return null (triggers CredentialsSignin error) — caller sees generic message
            return null;
          }

          const data = await res.json();
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.full_name,
            role: data.user.role,
            isVerified: data.user.is_verified,
            onboardingStatus: data.user.onboarding_status ?? "not_started",
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            accessTokenExpires: Date.now() + 14 * 60 * 1000,
          };
        } catch {
          // Network error (backend not running) — return null so NextAuth shows
          // "Invalid credentials" instead of a "Configuration" error page.
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in — seed token from authorize() return value
      if (user) {
        return {
          ...token,
          id: user.id,
          role: (user as any).role,
          isVerified: (user as any).isVerified,
          onboardingStatus: (user as any).onboardingStatus ?? "not_started",
          accessToken: (user as any).accessToken,
          refreshToken: (user as any).refreshToken,
          accessTokenExpires: (user as any).accessTokenExpires,
          error: undefined,
        };
      }

      // Client-driven refresh of onboarding progress via useSession().update():
      // after each onboarding step completes we push the new status into the JWT
      // so the edge middleware gate opens without waiting for a full re-login.
      if (trigger === "update" && (session as any)?.onboardingStatus) {
        token.onboardingStatus = (session as any).onboardingStatus;
        return token;
      }

      // Access token still valid
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token expired — attempt silent refresh
      const refreshed = await refreshAccessToken(token.refreshToken as string);
      if ("error" in refreshed) {
        return { ...token, error: "RefreshAccessTokenError" };
      }
      return {
        ...token,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        accessTokenExpires: refreshed.accessTokenExpires,
        error: undefined,
      };
    },

    async session({ session, token }) {
      // Expose to the client — never include the raw refreshToken
      (session as any).user = {
        ...session.user,
        id: token.id,
        role: token.role,
        isVerified: token.isVerified,
        onboardingStatus: (token as any).onboardingStatus ?? "not_started",
      };
      (session as any).accessToken = token.accessToken;
      (session as any).error = token.error;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
    newUser: "/register",
  },

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,

  // Cookies — httpOnly, Secure in production
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
