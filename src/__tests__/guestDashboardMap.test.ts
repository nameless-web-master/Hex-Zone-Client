import { describe, expect, it } from "vitest";
import { tryParseGuestDashboardMap } from "../lib/guestDashboardMap";

describe("tryParseGuestDashboardMap", () => {
  it("parses GeoJSON Polygon under map.geojson into leaflet rings", () => {
    const model = tryParseGuestDashboardMap({
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
    });
    expect(model).not.toBeNull();
    expect(model?.polygons.length).toBe(1);
    expect(model?.polygons[0].length).toBeGreaterThanOrEqual(4);
  });

  it("returns null when no recognizable geometry", () => {
    expect(tryParseGuestDashboardMap({ label: "Hello" })).toBeNull();
  });
});
