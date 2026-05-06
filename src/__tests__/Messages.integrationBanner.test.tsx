import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("Messages integration banner", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("does not surface the misleading empty-PERMISSION copy when the feed batch includes PERMISSION", () => {
    render(<Messages />);
    expect(
      screen.queryByText(/No PERMISSION type entries in your current inbox batch/i),
    ).toBeNull();
    expect(screen.getByText("Access info")).toBeInTheDocument();
    expect(screen.getByText(/This inbox batch includes PERMISSION rows/i)).toBeInTheDocument();
  });

  it("with verbose banner enabled, still omits empty-PERMISSION copy when PERMISSION rows exist", () => {
    vi.stubEnv("VITE_SHOW_MESSAGES_INTEGRATION_BANNER", "true");
    render(<Messages />);
    expect(
      screen.queryByText(/No PERMISSION type entries in your current inbox batch/i),
    ).toBeNull();
    expect(screen.getByText(/this UI does not fabricate PERMISSION envelopes/i)).toBeInTheDocument();
  });
});
