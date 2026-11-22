export interface TimeOfDayColors {
  skyColor: number;
  groundColor: number;
  sunColor: number;
  ambientColor: number;
  fogColor: number;
  hemisphereIntensity: number;
  sunIntensity: number;
  ambientIntensity: number;
  fogNear: number;
  fogFar: number;
}

// The world controller and biome lab edit and read this one table.
export const WORLD_ATMOSPHERE_PRESETS: Record<string, TimeOfDayColors> = {
  deepNight: {
    // 0, 100. Fill sits low so the moon light keeps shading on units and roofs; labels stay readable on the cooler sky.
    skyColor: 0x3a4d70,
    groundColor: 0x364868,
    sunColor: 0xa998f0,
    ambientColor: 0x6f88bd,
    fogColor: 0x4f6788,
    hemisphereIntensity: 1.35,
    sunIntensity: 2.65,
    ambientIntensity: 0.55,
    fogNear: 15,
    fogFar: 56,
  },
  dawn: {
    // 16.7
    skyColor: 0xffba8a,
    groundColor: 0x9f7188,
    sunColor: 0xffd0a5,
    ambientColor: 0xb994b2,
    fogColor: 0xd4a8b0,
    hemisphereIntensity: 1.8,
    sunIntensity: 2.3,
    ambientIntensity: 0.76,
    fogNear: 22,
    fogFar: 58,
  },
  morning: {
    skyColor: 0xa9cff2,
    groundColor: 0xc9bea6,
    sunColor: 0xffd9a8,
    ambientColor: 0xc9d8e8,
    fogColor: 0xcfe0ee,
    hemisphereIntensity: 1.8,
    sunIntensity: 2.8,
    ambientIntensity: 0.6,
    fogNear: 30,
    fogFar: 82,
  },
  day: {
    // 50
    skyColor: 0xb8d8f2,
    groundColor: 0xd6c7ad,
    sunColor: 0xfff2dc,
    ambientColor: 0xf2dfc7,
    fogColor: 0xd2e2f0,
    hemisphereIntensity: 1.9,
    sunIntensity: 3.0,
    ambientIntensity: 0.62,
    fogNear: 32,
    fogFar: 82,
  },
  afternoon: {
    skyColor: 0x90a8c6,
    groundColor: 0x7c6e5e,
    sunColor: 0xffc590,
    ambientColor: 0x9eafc0,
    fogColor: 0xc9cfda,
    hemisphereIntensity: 1.45,
    sunIntensity: 3.4,
    ambientIntensity: 0.5,
    fogNear: 28,
    fogFar: 72,
  },
  dusk: {
    skyColor: 0xe0a07c,
    groundColor: 0x8a6c66,
    sunColor: 0xffb27a,
    ambientColor: 0xa8a6bc,
    fogColor: 0xc9a8a8,
    hemisphereIntensity: 1.7,
    sunIntensity: 2.7,
    ambientIntensity: 0.7,
    fogNear: 26,
    fogFar: 66,
  },
  evening: {
    // 83.3. Same rule as night: less fill, a little more directional light.
    skyColor: 0x667fb8,
    groundColor: 0x4d5c7a,
    sunColor: 0xd4e0ff,
    ambientColor: 0x8aa2d2,
    fogColor: 0x5f79a1,
    hemisphereIntensity: 1.45,
    sunIntensity: 2.55,
    ambientIntensity: 0.6,
    fogNear: 20,
    fogFar: 54,
  },
};
