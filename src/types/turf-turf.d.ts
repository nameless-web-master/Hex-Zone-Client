declare module "@turf/turf" {
  import type { Feature, Polygon, Point } from "geojson";
  export function area(feature: Feature<Polygon>): number;
  export function booleanPointInPolygon(
    point: Feature<Point>,
    polygon: Feature<Polygon>,
  ): boolean;
  export function point(coordinates: [number, number]): Feature<Point>;
  export function polygon(
    coordinates: [number, number][][],
  ): Feature<Polygon>;
  export function distance(
    from: Feature<Point>,
    to: Feature<Point>,
    options: { units: string },
  ): number;
}
