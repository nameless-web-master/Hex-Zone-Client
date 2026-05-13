import { describe, expect, it, vi } from "vitest";
import {
  buildGuestCheckInRedirectPath,
  completeGuestSessionAuthFailureRedirect,
  guestSession401TryBeginRedirect,
  registerGuestSessionAuthNavigate,
  resetGuestSession401RedirectGuard,
} from "../lib/guestSessionAuthRedirect";

describe("buildGuestCheckInRedirectPath", () => {
  it("omits from when back is /access", () => {
    expect(buildGuestCheckInRedirectPath("/access")).toBe("/access");
  });

  it("preserves guest return path in from", () => {
    expect(buildGuestCheckInRedirectPath("/guest/dashboard")).toBe(
      "/access?from=%2Fguest%2Fdashboard",
    );
  });

  it("does not set from for /access with query", () => {
    expect(buildGuestCheckInRedirectPath("/access?zid=z")).toBe("/access");
  });
});

describe("guest session 401 redirect guard", () => {
  it("only the first tryBegin wins until reset", () => {
    resetGuestSession401RedirectGuard();
    expect(guestSession401TryBeginRedirect()).toBe(true);
    expect(guestSession401TryBeginRedirect()).toBe(false);
    resetGuestSession401RedirectGuard();
    expect(guestSession401TryBeginRedirect()).toBe(true);
  });

  it("completeGuestSessionAuthFailureRedirect uses registered navigate", () => {
    resetGuestSession401RedirectGuard();
    const nav = vi.fn();
    registerGuestSessionAuthNavigate(nav);
    vi.stubGlobal("window", {
      location: {
        pathname: "/guest/messages",
        search: "",
        hash: "",
        replace: vi.fn(),
      },
    });
    completeGuestSessionAuthFailureRedirect();
    expect(nav).toHaveBeenCalledWith("/access?from=%2Fguest%2Fmessages", { replace: true });
    registerGuestSessionAuthNavigate(null);
    vi.unstubAllGlobals();
  });
});
