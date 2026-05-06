import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { GuestRequestsDashboardSection } from "../components/dashboard/GuestRequestsDashboardSection";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ token: "token" }),
}));
vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => ({ lastMessage: null }),
}));
vi.mock("../services/api/accessPermissions", () => ({
  listGuestRequestsForZone: vi.fn(),
  approveGuestPermissionRequestRemote: vi.fn().mockResolvedValue({ error: null }),
  denyGuestPermissionRequestRemote: vi.fn().mockResolvedValue({ error: null }),
  createGuestChatThreadPlaceholder: vi.fn().mockResolvedValue({ error: null, data: {} }),
}));

describe("Guest requests approve/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes list after approve and reject", async () => {
    const mod = await import("../services/api/accessPermissions");
    vi.mocked(mod.listGuestRequestsForZone).mockResolvedValue({
      error: null,
      data: [{ id: "g1", zoneId: "ZONE-1", expectation: "unexpected", status: "PENDING" }],
    } as never);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GuestRequestsDashboardSection zoneId="ZONE-1" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(mod.listGuestRequestsForZone).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: /reject/i }));
    await waitFor(() => expect(mod.listGuestRequestsForZone).toHaveBeenCalledTimes(3));
  });
});

