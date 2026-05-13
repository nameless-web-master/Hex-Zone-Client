import "@testing-library/jest-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import GuestAccess from "../pages/GuestAccess";
import {
  pollGuestAccessSession,
  submitAnonymousGuestPermission,
} from "../services/api/accessPermissions";
import {
  exchangeGuestSession,
  persistGuestSessionAfterExchange,
} from "../services/api/guestSession";

vi.mock("../services/api/accessPermissions", () => ({
  pollGuestAccessSession: vi.fn(),
  submitAnonymousGuestPermission: vi.fn(),
}));

vi.mock("../services/api/guestSession", () => ({
  exchangeGuestSession: vi.fn(),
  persistGuestSessionAfterExchange: vi.fn(),
}));

const submitMock = vi.mocked(submitAnonymousGuestPermission);
const pollMock = vi.mocked(pollGuestAccessSession);
const exchangeMock = vi.mocked(exchangeGuestSession);
const persistMock = vi.mocked(persistGuestSessionAfterExchange);

describe("GuestAccess approved + exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("after approval with exchange code, auto-exchanges and navigates to guest dashboard", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      ok: true,
      status: "UNEXPECTED",
      message: "Waiting",
      guestId: "guest-ref-1",
      zoneId: "zone-1",
    });
    pollMock.mockResolvedValue({
      status: "APPROVED",
      exchange_code: "one-time-code",
      error: null,
    });
    exchangeMock.mockResolvedValue({
      data: {
        access_token: "guest-jwt",
        token_type: "Bearer",
        expires_in: 3600,
        guest: {
          guest_id: "guest-ref-1",
          display_name: "Casey",
          zone_ids: ["zone-1"],
          allowed_message_types: ["CHAT", "PERMISSION"],
        },
      },
      error: null,
    });

    const router = createMemoryRouter(
      [
        { path: "/access", element: <GuestAccess /> },
        { path: "/guest/dashboard", element: <div>Guest dashboard reached</div> },
      ],
      { initialEntries: ["/access?gt=token1&zid=zone-1"] },
    );

    render(<RouterProvider router={router} />);

    await user.type(screen.getByLabelText(/your name/i), "Casey");
    await user.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/guest/dashboard");
    });

    expect(exchangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        guest_id: "guest-ref-1",
        zone_id: "zone-1",
        exchange_code: "one-time-code",
      }),
    );
    expect(persistMock).toHaveBeenCalled();
  });

  it("EXPECTED with exchange_code from permission POST auto-exchanges without polling", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      ok: true,
      status: "EXPECTED",
      message: "Guest pass verified.",
      guestId: "guest-exp-1",
      zoneId: "zone-1",
      exchange_code: "immediate-code",
      exchange_expires_at: "2026-12-31T00:00:00.000Z",
    });
    exchangeMock.mockResolvedValue({
      data: {
        access_token: "guest-jwt",
        token_type: "Bearer",
        expires_in: 3600,
        guest: {
          guest_id: "guest-exp-1",
          display_name: "Alex",
          zone_ids: ["zone-1"],
          allowed_message_types: ["CHAT"],
        },
      },
      error: null,
    });

    const router = createMemoryRouter(
      [
        { path: "/access", element: <GuestAccess /> },
        { path: "/guest/dashboard", element: <div>Guest dashboard reached</div> },
      ],
      { initialEntries: ["/access?gt=token1&zid=zone-1"] },
    );

    render(<RouterProvider router={router} />);

    await user.type(screen.getByLabelText(/your name/i), "Alex");
    await user.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/guest/dashboard");
    });

    expect(pollMock).not.toHaveBeenCalled();
    expect(exchangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        guest_id: "guest-exp-1",
        zone_id: "zone-1",
        exchange_code: "immediate-code",
      }),
    );
    expect(persistMock).toHaveBeenCalled();
  });

  it("poll APPROVED without exchange_code shows actionable API message (not silent hang)", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      ok: true,
      status: "UNEXPECTED",
      message: "Waiting",
      guestId: "guest-ref-2",
      zoneId: "zone-1",
    });
    pollMock.mockResolvedValue({
      status: "APPROVED",
      error: null,
    });
    exchangeMock.mockResolvedValue({ data: null, error: null });

    const router = createMemoryRouter(
      [
        { path: "/access", element: <GuestAccess /> },
        { path: "/guest/dashboard", element: <div>Guest dashboard reached</div> },
      ],
      { initialEntries: ["/access?gt=token1&zid=zone-1"] },
    );

    render(<RouterProvider router={router} />);

    await user.type(screen.getByLabelText(/your name/i), "Riley");
    await user.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/did not send a sign-in code \(exchange_code\)/i),
      ).toBeInTheDocument();
    });

    expect(exchangeMock).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/access");
  });

  it("reject path shows declined UI", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      ok: true,
      status: "UNEXPECTED",
      message: "Waiting",
      guestId: "guest-ref-3",
      zoneId: "zone-1",
    });
    pollMock.mockResolvedValue({
      status: "REJECTED",
      message: "Host declined.",
      error: null,
    });

    const router = createMemoryRouter(
      [{ path: "/access", element: <GuestAccess /> }],
      { initialEntries: ["/access?gt=token1&zid=zone-1"] },
    );

    render(<RouterProvider router={router} />);

    await user.type(screen.getByLabelText(/your name/i), "Sam");
    await user.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(screen.getByText(/not approved/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/host declined/i)).toBeInTheDocument();
  });
});
