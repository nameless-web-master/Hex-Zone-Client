import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GuestQrTokensAdmin } from "../components/guestQr/GuestQrTokensAdmin";

vi.mock("../services/api/guestQrTokens", () => ({
  fetchPrimaryGuestQrToken: vi.fn(),
  rotatePrimaryGuestQrToken: vi.fn(),
  guestPrimaryQrRotatePath: () => "/api/access/qr-tokens/primary/rotate",
}));

vi.mock("../services/api/client", () => ({
  apiClient: {
    options: vi.fn().mockResolvedValue({ status: 404 }),
  },
}));

import { fetchPrimaryGuestQrToken } from "../services/api/guestQrTokens";

describe("GuestQrTokensAdmin primary token flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads primary token URL and does not show expiry controls", async () => {
    vi.mocked(fetchPrimaryGuestQrToken).mockResolvedValue({
      data: {
        zone_id: "ZONE-1",
        path_with_query: "/access?gt=stable-123",
      },
      error: null,
      loading: false,
    });

    render(<GuestQrTokensAdmin zoneId="ZONE-1" />);

    await waitFor(() => {
      expect(screen.getByText(/reusable guest qr for this zone/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/no expiration unless manually rotated\/revoked by admin/i)).toBeInTheDocument();
    expect(screen.queryByText(/expiry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/expires_at/i)).not.toBeInTheDocument();
  });
});

