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
    // 0, 100
    skyColor: 0x344562,
    groundColor: 0x405477,
    sunColor: 0x9b7ee8,
    ambientColor: 0x7891c4,
    fogColor: 0x536b8c,
    hemisphereIntensity: 1.6,
    sunIntensity: 1.85,
    ambientIntensity: 0.8,
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
    hemisphereIntensity: 1.65,
    sunIntensity: 1.65,
    ambientIntensity: 0.72,
    fogNear: 22,
    fogFar: 58,
  },
  morning: {
    // 33.3
    skyColor: 0xb7dcff,
    groundColor: 0xd8c7a9,
    sunColor: 0xfff5d5,
    ambientColor: 0xffecd3,
    fogColor: 0xd2e5f4,
    hemisphereIntensity: 1.65,
    sunIntensity: 1.95,
    ambientIntensity: 0.56,
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
    hemisphereIntensity: 1.7,
    sunIntensity: 1.85,
    ambientIntensity: 0.56,
    fogNear: 32,
    fogFar: 82,
  },
  afternoon: {
    // 58.3
    skyColor: 0xb4cee8,
    groundColor: 0xcab89f,
    sunColor: 0xffd8aa,
    ambientColor: 0xecc8b0,
    fogColor: 0xcbd2dc,
    hemisphereIntensity: 1.6,
    sunIntensity: 1.65,
    ambientIntensity: 0.68,
    fogNear: 28,
    fogFar: 72,
  },
  dusk: {
    // 66.7
    skyColor: 0xff9f72,
    groundColor: 0x9a6682,
    sunColor: 0xffbd8e,
    ambientColor: 0xc591aa,
    fogColor: 0xd39aab,
    hemisphereIntensity: 1.65,
    sunIntensity: 1.55,
    ambientIntensity: 0.74,
    fogNear: 24,
    fogFar: 62,
  },
  evening: {
    // 83.3
    skyColor: 0x667fb8,
    groundColor: 0x53617e,
    sunColor: 0xd4e0ff,
    ambientColor: 0x8aa2d2,
    fogColor: 0x637da5,
    hemisphereIntensity: 1.55,
    sunIntensity: 2.05,
    ambientIntensity: 0.74,
    fogNear: 20,
    fogFar: 54,
  },
};
