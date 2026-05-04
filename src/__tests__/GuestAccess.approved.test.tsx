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

  it("after approval with exchange code, Continue exchanges and navigates to guest dashboard", async () => {
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
      expect(screen.getByRole("button", { name: /continue to guest dashboard/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /continue to guest dashboard/i }));

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
});
