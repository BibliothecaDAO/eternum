export type MapLayer = "world" | "ethereal";

export function mapLayerToAlt(layer: MapLayer): boolean {
  return layer === "ethereal";
}

export function normalizeMapLayer(layer: MapLayer | boolean): MapLayer {
  if (typeof layer === "boolean") {
    return layer ? "ethereal" : "world";
  }

  return layer;
}
