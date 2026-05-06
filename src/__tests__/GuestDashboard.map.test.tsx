import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GuestDashboard from "../pages/guest/GuestDashboard";

vi.mock("../lib/guestAccessToken", () => ({
  getGuestSessionMeta: () => ({
    guest_id: "g1",
    zone_id: "ZONE-MAP",
    zone_ids: ["ZONE-MAP"],
    display_name: "Guest",
    allowed_message_types: ["CHAT"],
  }),
}));

vi.mock("../services/api/guestMessages", () => ({
  fetchGuestMe: vi.fn().mockResolvedValue({
    data: {
      guest_id: "g1",
      display_name: "Guest",
      zone_ids: ["ZONE-MAP"],
      allowed_message_types: ["CHAT"],
    },
    error: null,
  }),
  fetchGuestZoneDashboard: vi.fn().mockResolvedValue({
    data: {
      label: "Test zone",
      map: {
        geojson: {
          type: "Polygon",
          coordinates: [
            [
              [-74.02, 40.71],
              [-73.93, 40.71],
              [-73.93, 40.79],
              [-74.02, 40.79],
              [-74.02, 40.71],
            ],
          ],
        },
      },
    },
    error: null,
  }),
}));

vi.mock("../components/guest/GuestZoneReadOnlyMap", () => ({
  default: () => <div data-testid="guest-readonly-map-stub">map-stub</div>,
}));

describe("GuestDashboard map wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders read-only map when dashboard payload contains geo", async () => {
    render(
      <MemoryRouter>
        <GuestDashboard />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("guest-readonly-map-stub")).toBeInTheDocument());
    expect(screen.getByText(/zone map \(read-only\)/i)).toBeInTheDocument();
  });
});
