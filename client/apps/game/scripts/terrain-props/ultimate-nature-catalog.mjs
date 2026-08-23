export const ULTIMATE_NATURE_CATALOG_VERSION = 1;
export const ULTIMATE_NATURE_LICENSE = "CC0-1.0";
export const ULTIMATE_NATURE_SOURCE_PAGE = "https://quaternius.com/packs/ultimatenature.html";
export const ULTIMATE_NATURE_ARCHIVE_URL =
  "https://opengameart.org/sites/default/files/ultimate_nature_pack_by_quaternius_1.zip";
export const ULTIMATE_NATURE_ARCHIVE_ROOT = "Ultimate Nature Pack - Jun 2019";
export const ULTIMATE_NATURE_MAX_GLB_BYTES = 750 * 1024;

export const ULTIMATE_NATURE_PROPS = Object.freeze([
  defineProp("broadleaf", "CommonTree_3.fbx", 1.25, 700, 160, "green"),
  defineProp("birch", "BirchTree_2.fbx", 1.3, 700, 160, "green"),
  defineProp("willow", "Willow_4.fbx", 1.35, 700, 160, "green"),
  defineProp("conifer", "PineTree_5.fbx", 1.35, 600, 140, "green"),
  defineProp("palm", "PalmTree_3.fbx", 1.45, 600, 140, "green"),
  defineProp("dead-tree", "CommonTree_Dead_3.fbx", 1.2, 450, 120, null),
  defineProp("shrub", "Bush_2.fbx", 0.32, 200, 60, ".*"),
  defineProp("cactus", "Cactus_2.fbx", 0.62, 350, 100, null),
  defineProp("boulder", "Rock_4.fbx", 0.22, 128, 80, null),
  defineProp("stump", "TreeStump.fbx", 0.22, 232, 80, null),
  defineProp("fallen-log", "WoodLog.fbx", 0.18, 240, 80, null),
]);

export function validateUltimateNatureCatalog(props = ULTIMATE_NATURE_PROPS) {
  const failures = [];
  const ids = new Set();
  const files = new Set();

  for (const prop of props) {
    if (ids.has(prop.id)) failures.push(`duplicate prop id: ${prop.id}`);
    if (files.has(prop.sourceFile)) failures.push(`duplicate source file: ${prop.sourceFile}`);
    if (!prop.sourceFile.endsWith(".fbx")) failures.push(`${prop.id} source must be FBX`);
    if (!(prop.targetHeight > 0)) failures.push(`${prop.id} target height must be positive`);
    if (!(prop.nearTriangles > 0)) failures.push(`${prop.id} near triangle budget must be positive`);
    if (!(prop.farTriangles > 0 && prop.farTriangles <= prop.nearTriangles)) {
      failures.push(`${prop.id} far triangle budget must be positive and no larger than near`);
    }
    ids.add(prop.id);
    files.add(prop.sourceFile);
  }

  return failures;
}

export function getUltimateNatureTriangleBudgets(props = ULTIMATE_NATURE_PROPS) {
  return props.reduce(
    (totals, prop) => ({
      near: totals.near + prop.nearTriangles,
      far: totals.far + prop.farTriangles,
    }),
    { near: 0, far: 0 },
  );
}

function defineProp(id, sourceFile, targetHeight, nearTriangles, farTriangles, windMaterialPattern) {
  return Object.freeze({
    id,
    sourceFile,
    targetHeight,
    nearTriangles,
    farTriangles,
    windMaterialPattern,
  });
}
