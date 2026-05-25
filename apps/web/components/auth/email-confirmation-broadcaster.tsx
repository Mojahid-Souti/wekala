"use client";

/**
 * Detects the URL fragment GoTrue appends after the user clicks the email
 * confirmation link and broadcasts a cross-tab event so any VerifyForm sitting
 * open in another tab can react (transition to "done" + redirect to login).
 *
 * GoTrue's confirmation flow:
 *   1. User clicks the link in their email.
 *   2. GoTrue's /auth/v1/verify confirms the email, then 302-redirects to
 *      SITE_URL (= http://localhost:3002) with a URL fragment containing
 *      `#access_token=...&refresh_token=...&type=signup&expires_in=...`.
 *   3. Wekala's GuestGuard sends an unauthenticated visitor to /login, so
 *      this component runs on the auth layout (covering /login, /verify,
 *      /signup, etc.) and catches the fragment regardless of which auth
 *      page hydrated first.
 *
 * Once detected we broadcast on the "wekala-auth" channel and strip the
 * fragment from the URL so a refresh doesn't re-fire the event.
 */

import { useEffect } from "react";

export const AUTH_BROADCAST_CHANNEL = "wekala-auth";
export const EMAIL_CONFIRMED_EVENT = "email-confirmed";

export function EmailConfirmationBroadcaster() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;
    // Strip leading "#" and parse like a query string.
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const type = params.get("type");
    if (type !== "signup" && type !== "invite") return;

    try {
      const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
      channel.postMessage({ type: EMAIL_CONFIRMED_EVENT, at: Date.now() });
      channel.close();
    } catch {
      // BroadcastChannel unsupported (very old browsers) — silently skip.
    }

    // Strip the fragment so a manual refresh doesn't re-broadcast.
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", cleanUrl);
  }, []);

  return null;
}
