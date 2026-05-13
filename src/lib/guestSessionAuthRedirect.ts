import type { NavigateFunction } from "react-router-dom";

const AUTH_EXPIRED_FLASH_KEY = "zoneweaver_guest_session_auth_expired_notice";

let redirectInFlight = false;

let navigateRef: NavigateFunction | null = null;

/** Reset after a successful guest token exchange so a later 401 can redirect again. */
export function resetGuestSession401RedirectGuard(): void {
  redirectInFlight = false;
}

/**
 * Returns true if this call acquired the one-shot redirect lock (caller should clear session and navigate).
 * Parallel 401s only get true from the first caller.
 */
export function guestSession401TryBeginRedirect(): boolean {
  if (redirectInFlight) return false;
  redirectInFlight = true;
  return true;
}

export function registerGuestSessionAuthNavigate(nav: NavigateFunction | null): void {
  navigateRef = nav;
}

export function buildGuestCheckInRedirectPath(back: string): string {
  const trimmed = (back || "").trim();
  const params = new URLSearchParams();
  if (
    trimmed &&
    trimmed !== "/access" &&
    !trimmed.startsWith("/access?") &&
    !trimmed.startsWith("/access#")
  ) {
    params.set("from", trimmed);
  }
  const qs = params.toString();
  return qs ? `/access?${qs}` : "/access";
}

export function setGuestAuthExpiredNoticeFlash(): void {
  try {
    sessionStorage.setItem(AUTH_EXPIRED_FLASH_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeGuestAuthExpiredNoticeFlash(): boolean {
  try {
    const v = sessionStorage.getItem(AUTH_EXPIRED_FLASH_KEY);
    if (v) {
      sessionStorage.removeItem(AUTH_EXPIRED_FLASH_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Flash + SPA navigate (or full replace if navigate is not registered yet). */
export function completeGuestSessionAuthFailureRedirect(): void {
  setGuestAuthExpiredNoticeFlash();
  const back =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : "";
  const to = buildGuestCheckInRedirectPath(back);
  const nav = navigateRef;
  if (nav) {
    nav(to, { replace: true });
  } else if (typeof window !== "undefined") {
    window.location.replace(to);
  }
}
