/**
 * Wekala→n8n session bridge (browser-facing Route Handler).
 *
 * The browser POSTs here with the user's Wekala JWT in the Authorization
 * header. We proxy to the Wekala API's /v1/n8n/session endpoint over the
 * internal docker network, then echo the n8n-auth cookie back to the
 * browser scoped to /n8n. Because this response is same-origin
 * (localhost:3002), the cookie sticks and the iframe at /n8n/* picks it up
 * automatically on its next request.
 *
 * Returns 200 on success (with cookie set), 401 if no auth header, 502 on
 * upstream failure.
 */

import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function apiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://wekala-api:8001"
  );
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) {
    return NextResponse.json({ error: "missing authorization header" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/n8n/session`, {
      method: "POST",
      headers: { Authorization: auth },
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "wekala api unreachable", detail: String(err) },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json(
      { error: "session mint failed", detail: text.slice(0, 500) },
      { status: upstream.status }
    );
  }

  const body = (await upstream.json()) as {
    cookie_name: string;
    cookie_value: string;
    max_age_s: number;
    cookie_path?: string;
  };

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: body.cookie_name,
    value: body.cookie_value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: body.cookie_path ?? "/n8n",
    maxAge: body.max_age_s,
  });
  return res;
}
