export interface FastTravelSurfacePalette {
  backgroundColor: "#000000";
  fillColor: "#05000a";
  fillOpacity: 0.32;
  edgeColor: "#ff4fd8";
  edgeOpacity: 0.92;
  glowColor: "#ff92ea";
  accentColor: "#ffd6f7";
}

export function createFastTravelSurfacePalette(): FastTravelSurfacePalette {
  return {
    backgroundColor: "#000000",
    fillColor: "#05000a",
    fillOpacity: 0.32,
    edgeColor: "#ff4fd8",
    edgeOpacity: 0.92,
    glowColor: "#ff92ea",
    accentColor: "#ffd6f7",
  };
}
