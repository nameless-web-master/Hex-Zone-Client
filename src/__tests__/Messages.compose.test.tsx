import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Messages from "../pages/Messages";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, zone_id: "ZONE-1" } }),
}));
vi.mock("../hooks/useMessageFeed", () => ({
  useMessageFeed: () => ({ messages: [], zones: ["ZONE-1"], loading: false, error: null }),
}));
vi.mock("../services/api/zones", () => ({
  getZones: vi.fn().mockResolvedValue({ data: [{ id: "ZONE-1" }] }),
}));
vi.mock("../services/api/auth", () => ({
  getOwners: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock("../services/api/members", () => ({
  getMembers: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock("../services/api/accessPermissions", () => ({
  listGuestRequestsForZone: vi.fn().mockResolvedValue({ data: [], error: null }),
}));
vi.mock("../components/messages/MessageList", () => ({
  MessageList: () => <div>list</div>,
}));
vi.mock("../components/messages/MessageDetail", () => ({
  MessageDetail: () => <div>detail</div>,
}));

describe("Messages compose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not include PERMISSION in compose type dropdown", async () => {
    render(<Messages />);
    await waitFor(() => {
      expect(screen.getByText("Compose")).toBeInTheDocument();
    });
    const selects = screen.getAllByRole("combobox");
    const composeSelect = selects[selects.length - 1];
    const options = Array.from(composeSelect.querySelectorAll("option")).map((o) => o.value);
    expect(options).toContain("CHAT");
    expect(options).not.toContain("PERMISSION");
  });
});

