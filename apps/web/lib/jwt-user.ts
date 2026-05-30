/**
 * Helpers to read user-facing fields out of the Supabase JWT we already
 * keep in storage. No verification — the token has already been verified
 * server-side by anything that consumes it; this is just for UI display.
 */

type SupabasePayload = {
  sub?: string;
  email?: string;
  user_metadata?: { full_name?: string };
};

function decodePayload(token: string): SupabasePayload | null {
  try {
    const middle = token.split(".")[1];
    if (!middle) return null;
    // Base64URL → standard base64
    const b64 = middle.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    if (typeof atob !== "function") return null;
    const json = atob(padded);
    return JSON.parse(json) as SupabasePayload;
  } catch {
    return null;
  }
}

export function getFullNameFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const payload = decodePayload(token);
  const name = payload?.user_metadata?.full_name?.trim();
  return name || null;
}

export function getFirstNameFromToken(token: string | null | undefined): string | null {
  const full = getFullNameFromToken(token);
  if (!full) return null;
  return full.split(/\s+/)[0] ?? full;
}
