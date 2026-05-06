/**
 * Responsive shell: mirror Dashboard map min-height on large viewports — see Tailwind tokens on wrapper.
 */
import "@testing-library/jest-dom";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GuestZoneReadOnlyMap from "../components/guest/GuestZoneReadOnlyMap";

const fitBounds = vi.fn();
vi.mock("leaflet", () => ({
  default: {
    latLngBounds: () => ({ pad: () => ({}) }),
  },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="map-container" className={className}>
      {children}
    </div>
  ),
  TileLayer: () => null,
  Polygon: () => null,
  useMap: () => ({ fitBounds }),
}));

describe("GuestZoneReadOnlyMap shell", () => {
  it("uses at least 360px min-height and matches Dashboard-scale lg min-height cap", () => {
    const { container } = render(
      <GuestZoneReadOnlyMap
        center={[40.75, -73.98]}
        polygons={[
          [
            [40.71, -74.02],
            [40.71, -73.93],
            [40.79, -73.93],
            [40.79, -74.02],
          ],
        ]}
      />,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toMatch(/min-h-\[360px\]/);
    expect(shell.className).toMatch(/lg:min-h-\[min\(calc\(100dvh-12rem\),720px\)\]/);
    expect(screen.getByTestId("map-container")).toHaveClass("h-full", "w-full");
  });
});
