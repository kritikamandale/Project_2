/**
 * GET /api/csrf — issues a CSRF token using the double-submit cookie pattern.
 *
 * Sets a non-httpOnly __csrf cookie and returns the same value in JSON.
 * Client reads the cookie value and sends it as X-CSRF-Token on mutations.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export function GET() {
  const token = randomBytes(32).toString("hex");

  const response = NextResponse.json({ token });

  response.cookies.set("__csrf", token, {
    httpOnly: false,     // JS must be able to read it for double-submit
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 3600,        // 1 hour — refresh on page load
  });

  return response;
}
