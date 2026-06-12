import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Authenticated proxy to FastAPI — attaches Bearer token from session
// ---------------------------------------------------------------------------

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await auth();

  const targetPath = params.path.join("/");
  const targetUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/${targetPath}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.set("Content-Type", "application/json");

  const accessToken = (session?.user as any)?.accessToken as string | undefined;
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const proxied = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    // @ts-expect-error — duplex required for streaming body
    duplex: "half",
  });

  return new NextResponse(proxied.body, {
    status: proxied.status,
    headers: {
      "Content-Type": proxied.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
