import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../pages/Dashboard";

const mockMap = vi.fn(() => <div data-testid="hex-map" />);

const mockUseZones = vi.fn();

vi.mock("../components/HexMapperMap", () => ({
  __esModule: true,
  default: (props: unknown) => mockMap(props),
  h3CellsAtPoint: () => [],
}));

vi.mock("../components/AddressAutocompleteInput", () => ({
  AddressAutocompleteInput: () => <div data-testid="address-input" />,
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "u-1",
      role: "standard",
      zone_id: "owner-zone",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
    },
  }),
}));

vi.mock("../hooks/useZones", () => ({
  useZones: (...args: unknown[]) => mockUseZones(...args),
}));

const baseZones = [
  { id: "1", zone_id: "owner-zone", name: "Alpha", h3_cells: ["a"], can_edit: true },
  { id: "2", zone_id: "owner-zone", name: "Beta", h3_cells: ["b"], can_edit: true },
];

describe("Dashboard zone management", () => {
  beforeEach(() => {
    mockMap.mockClear();
    mockUseZones.mockReset();
  });

  it("switches active tab and show-all toggle controls rendered layers", async () => {
    mockUseZones.mockReturnValue({
      zones: baseZones,
      capabilities: { can_create_zone: true },
      loading: false,
      error: null,
      saveZone: vi.fn(),
      updateSavedZone: vi.fn(),
    });

    render(<Dashboard />);

    await waitFor(() => expect(mockMap).toHaveBeenCalled());
    const latestProps = () => mockMap.mock.lastCall?.[0] as Record<string, unknown>;

    await waitFor(() => {
      const layers = latestProps().savedZoneCellLayers as Array<{ cells: string[] }>;
      expect(layers).toHaveLength(1);
      expect(layers[0].cells).toEqual(["a"]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    await waitFor(() => {
      const layers = latestProps().savedZoneCellLayers as Array<{ cells: string[] }>;
      expect(layers).toHaveLength(1);
      expect(layers[0].cells).toEqual(["b"]);
    });

    fireEvent.click(screen.getByLabelText("Show all zones"));
    await waitFor(() => {
      const layers = latestProps().savedZoneCellLayers as Array<{ cells: string[] }>;
      expect(layers).toHaveLength(2);
    });
  });

  it("disables new-zone action when backend capability blocks create", () => {
    mockUseZones.mockReturnValue({
      zones: [],
      capabilities: {
        can_create_zone: false,
        reason: "You have reached your allowed zone limit.",
      },
      loading: false,
      error: null,
      saveZone: vi.fn(),
      updateSavedZone: vi.fn(),
    });

    render(<Dashboard />);

    const newZoneButton = screen.getByRole("button", { name: /\+ New zone/i });
    expect(newZoneButton).toBeDisabled();
    expect(
      screen.getAllByText("You have reached your allowed zone limit.").length,
    ).toBeGreaterThan(0);
  });

  it("persists trimmed zone name when creating a zone", async () => {
    const saveZone = vi.fn().mockResolvedValue({});
    mockUseZones.mockReturnValue({
      zones: [],
      capabilities: { can_create_zone: true },
      loading: false,
      error: null,
      saveZone,
      updateSavedZone: vi.fn(),
    });

    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: /\+ New zone/i }));
    fireEvent.change(screen.getByLabelText("Zone name"), {
      target: { value: "  Operations West  " },
    });
    fireEvent.change(screen.getByLabelText("Zone type"), {
      target: { value: "custom_1" },
    });
    fireEvent.change(screen.getByLabelText("Communal ID"), {
      target: { value: "COMM-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create zone/i }));

    await waitFor(() => expect(saveZone).toHaveBeenCalledTimes(1));
    const payload = saveZone.mock.calls[0][0] as { name: string };
    expect(payload.name).toBe("Operations West");
  });

  it("shows backend quota errors when save is blocked", async () => {
    const updateSavedZone = vi.fn().mockRejectedValue(new Error("zone quota exceeded"));
    mockUseZones.mockReturnValue({
      zones: [baseZones[0]],
      capabilities: { can_create_zone: true },
      loading: false,
      error: null,
      saveZone: vi.fn(),
      updateSavedZone,
    });

    render(<Dashboard />);

    fireEvent.change(screen.getByLabelText("Zone type"), {
      target: { value: "custom_1" },
    });
    fireEvent.change(screen.getByLabelText("Communal ID"), {
      target: { value: "COMM-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save zone/i }));

    await waitFor(() => expect(updateSavedZone).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Quota limit:/i)).toBeInTheDocument();
  });
});
