import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Message } from "../services/api/messages";
import Messages from "../pages/Messages";

const chatMessage: Message = {
  id: "chat-1",
  zone_id: "ZONE-1",
  sender_id: 2,
  receiver_id: null,
  type: "CHAT",
  category: "Access",
  scope: "private",
  visibility: "private",
  message: "Guest ping",
  created_at: "2026-04-02T10:00:00Z",
  raw_payload: null,
};

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, zone_id: "ZONE-1" } }),
}));

vi.mock("../hooks/useMessageFeed", () => ({
  useMessageFeed: () => ({
    messages: [chatMessage],
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

describe("Messages CHAT with default filters", () => {
  it("shows CHAT rows without requiring category/scope/type filter changes", async () => {
    render(<Messages />);
    expect(await screen.findByText("Guest ping")).toBeInTheDocument();
    const rowButton = screen.getByText("Guest ping").closest("button");
    expect(rowButton).not.toBeNull();
    expect(rowButton!.textContent).toMatch(/CHAT/);
  });
});
