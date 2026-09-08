export const BIOME_KIT_MAX_GLB_BYTES = 750 * 1024;
export const BIOME_KIT_CANOPY_IDS = Object.freeze(["broadleaf", "birch", "rainforest-canopy", "conifer", "palm"]);

export const BIOME_KIT_PROPS = Object.freeze([
  defineProp("broadleaf", "temperate-deciduous-forest__oak-01", 1.25, 1158, 409, "foliage"),
  defineProp("birch", "temperate-deciduous-forest__birch-02", 1.3, 1218, 429, "foliage"),
  defineProp("rainforest-canopy", "tropical-rain-forest__jungle-01", 1.35, 1158, 409, "foliage"),
  defineProp("conifer", "taiga__pine-01", 1.35, 968, 385, "foliage"),
  defineProp("palm", "beach__palm-01", 1.45, 1070, 320, "foliage"),
  defineProp("dead-tree", "scorched__dead-01", 1.2, 302, 125, "none"),
  defineProp("shrub", "shrubland__shrub-01", 0.32, 273, 115, "all"),
  defineProp("cactus", "subtropical-desert__cactus-01", 0.62, 322, 110, "none"),
  defineProp("boulder", "bare__rock-01", 0.22, 98, 42, "none"),
  defineProp("mushroom", "temperate-deciduous-forest__mushrooms-04", 0.22, 350, 147, "none"),
  defineProp("fallen-log", "beach__log-04", 0.18, 246, 108, "none"),
  defineProp("grass-tuft", "grassland__grass-01", 0.12, 82, 36, "all"),
  defineProp("fern", "temperate-rain-forest__fern-03", 0.18, 513, 171, "all"),
  defineProp("cycad", "tropical-rain-forest__cycad-03", 0.24, 522, 237, "all"),
  defineProp("wildflower", "grassland__flowers-02", 0.13, 255, 90, "all"),
]);

export function validateBiomeKitCatalog(props = BIOME_KIT_PROPS) {
  const failures = [];
  const ids = new Set();
  const files = new Set();

  for (const prop of props) {
    if (ids.has(prop.id)) failures.push(`duplicate prop id: ${prop.id}`);
    if (files.has(prop.sourceId)) failures.push(`duplicate source file: ${prop.sourceId}`);
    if (!/^[a-z0-9-]+__[a-z0-9-]+$/.test(prop.sourceId)) failures.push(`${prop.id} source must be a biome kit prop id`);
    if (!(prop.targetHeight > 0)) failures.push(`${prop.id} target height must be positive`);
    if (!(prop.nearTriangles > 0)) failures.push(`${prop.id} near triangle budget must be positive`);
    if (!(prop.farTriangles > 0 && prop.farTriangles <= prop.nearTriangles)) {
      failures.push(`${prop.id} far triangle budget must be positive and no larger than near`);
    }
    ids.add(prop.id);
    files.add(prop.sourceId);
  }

  for (const canopyId of BIOME_KIT_CANOPY_IDS) {
    if (!ids.has(canopyId)) failures.push(`missing canopy prop: ${canopyId}`);
  }

  return failures;
}

export function getBiomeKitTriangleBudgets(props = BIOME_KIT_PROPS) {
  return props.reduce(
    (totals, prop) => ({
      near: totals.near + prop.nearTriangles,
      far: totals.far + prop.farTriangles,
    }),
    { near: 0, far: 0 },
  );
}

function defineProp(id, sourceId, targetHeight, nearTriangles, farTriangles, windMode) {
  return Object.freeze({
    id,
    sourceId,
    targetHeight,
    nearTriangles,
    farTriangles,
    windMode,
  });
}

export function resolveBiomeKitWindWeight(mode, rgba) {
  if (mode === "none") return 0;
  if (mode === "all") return 1;
  if (mode === "foliage") return rgba[1] > rgba[0] * 1.05 && rgba[1] > rgba[2] * 1.05 ? 1 : 0;
  throw new Error(`Unsupported wind mode ${mode}`);
}
