import "@testing-library/jest-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import GuestArrival from "../pages/GuestArrival";
import {
  pollGuestAccessSession,
  pollGuestApprovalStatus,
  submitGuestArrivalPermission,
} from "../services/api/accessPermissions";
import { exchangeGuestSession, persistGuestSessionAfterExchange } from "../services/api/guestSession";

vi.mock("../services/api/accessPermissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/api/accessPermissions")>();
  return {
    ...actual,
    submitGuestArrivalPermission: vi.fn(),
    pollGuestApprovalStatus: vi.fn(),
    pollGuestAccessSession: vi.fn(),
    requestGuestScanAuthToken: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
});

vi.mock("../services/api/guestSession", () => ({
  exchangeGuestSession: vi.fn(),
  persistGuestSessionAfterExchange: vi.fn(),
}));

const submitMock = vi.mocked(submitGuestArrivalPermission);
const approvalPollMock = vi.mocked(pollGuestApprovalStatus);
const sessionPollMock = vi.mocked(pollGuestAccessSession);
const exchangeMock = vi.mocked(exchangeGuestSession);
const persistMock = vi.mocked(persistGuestSessionAfterExchange);

describe("GuestArrival exchange + session poll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    approvalPollMock.mockResolvedValue({ data: null, error: null });
  });

  it("expected guest with exchange_code from permission navigates to guest dashboard", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      data: {
        expectation: "expected",
        approvalStatus: "NONE",
        pollingNeeded: false,
        guestId: "g-arrival-1",
        zoneId: "zone-a",
        exchange_code: "arrival-ex",
        exchange_expires_at: "2026-12-31T00:00:00.000Z",
      },
      error: null,
    });
    exchangeMock.mockResolvedValue({
      data: {
        access_token: "guest-jwt",
        token_type: "Bearer",
        expires_in: 3600,
        guest: {
          guest_id: "g-arrival-1",
          display_name: "Morgan",
          zone_ids: ["zone-a"],
          allowed_message_types: ["CHAT"],
        },
      },
      error: null,
    });

    const router = createMemoryRouter(
      [
        { path: "/guest-arrival", element: <GuestArrival /> },
        { path: "/guest/dashboard", element: <div>Guest dashboard reached</div> },
      ],
      { initialEntries: ["/guest-arrival?to=zone-a&token=scan-tok"] },
    );

    render(<RouterProvider router={router} />);

    await user.type(screen.getByLabelText(/guest name/i), "Morgan");
    await user.click(screen.getByRole("button", { name: /i have arrived/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/guest/dashboard");
    });

    expect(sessionPollMock).not.toHaveBeenCalled();
    expect(exchangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        guest_id: "g-arrival-1",
        zone_id: "zone-a",
        exchange_code: "arrival-ex",
      }),
    );
    expect(persistMock).toHaveBeenCalled();
  });

  it("after first approval poll is APPROVED, session poll supplies exchange_code", async () => {
    const user = userEvent.setup();

    submitMock.mockResolvedValue({
      data: {
        expectation: "unexpected",
        approvalStatus: "PENDING",
        pollingNeeded: true,
        requestId: "req-99",
        guestId: "req-99",
        zoneId: "zone-b",
      },
      error: null,
    });
    approvalPollMock.mockResolvedValue({ data: { status: "APPROVED" }, error: null });
    sessionPollMock.mockResolvedValue({
      status: "APPROVED",
      exchange_code: "from-session",
      error: null,
    });
    exchangeMock.mockResolvedValue({
      data: {
        access_token: "guest-jwt",
        token_type: "Bearer",
        expires_in: 3600,
        guest: {
          guest_id: "req-99",
          display_name: "Jo",
          zone_ids: ["zone-b"],
          allowed_message_types: ["CHAT"],
        },
      },
      error: null,
    });

    const router = createMemoryRouter(
      [
        { path: "/guest-arrival", element: <GuestArrival /> },
        { path: "/guest/dashboard", element: <div>Guest dashboard reached</div> },
      ],
      { initialEntries: ["/guest-arrival?to=zone-b&token=scan-tok-2"] },
    );

    render(<RouterProvider router={router} />);

    await user.type(screen.getByLabelText(/guest name/i), "Jo");
    await user.click(screen.getByRole("button", { name: /i have arrived/i }));

    await waitFor(() => {
      expect(sessionPollMock).toHaveBeenCalledWith("req-99", "zone-b");
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/guest/dashboard");
    });

    expect(exchangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        guest_id: "req-99",
        zone_id: "zone-b",
        exchange_code: "from-session",
      }),
    );
  });
});
