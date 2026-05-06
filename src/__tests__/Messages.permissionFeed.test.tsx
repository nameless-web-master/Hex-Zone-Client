import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { Message } from "../services/api/messages";
import Messages from "../pages/Messages";

const permissionMessage: Message = {
  id: "perm-1",
  zone_id: "ZONE-1",
  sender_id: 99,
  receiver_id: null,
  type: "PERMISSION",
  category: "Access",
  scope: "private",
  visibility: "private",
  message: "(Permission traffic)",
  created_at: "2026-04-01T10:00:00Z",
  raw_payload: null,
};

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, zone_id: "ZONE-1" } }),
}));
vi.mock("../hooks/useMessageFeed", () => ({
  useMessageFeed: () => ({
    messages: [permissionMessage],
    zones: ["ZONE-1"],
    loading: false,
    error: null,
  }),
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

describe("Messages PERMISSION feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows PERMISSION entries from the member message list", async () => {
    render(<Messages />);
    const bodySnippet = await screen.findByText("(Permission traffic)");
    const row = bodySnippet.closest("button");
    expect(row).not.toBeNull();
    within(row!).getByText("PERMISSION");
    within(row!).getByText("Access");
  });
});
