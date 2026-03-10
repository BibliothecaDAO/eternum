export function getStormLightIntensity(stormDepth: number, elapsedTime: number): number {
  const normalizedDepth = Math.max(0, Math.min(1, stormDepth));
  if (normalizedDepth <= 0.05) {
    return 0;
  }

  const baseIntensity = 0.2 + normalizedDepth * 0.4;
  const flickerAmplitude = 0.15 * normalizedDepth;
  return baseIntensity + Math.sin(elapsedTime * 0.3) * flickerAmplitude;
}

export function getStormFillLightMultiplier(stormDepth: number, elapsedTime: number, frequency: number): number {
  const normalizedDepth = Math.max(0, Math.min(1, stormDepth));
  if (normalizedDepth <= 0.05) {
    return 1;
  }

  return 1 + Math.sin(elapsedTime * frequency) * 0.06 * normalizedDepth;
}

export function applyFogDensityToRange(near: number, far: number, fogDensity: number): { near: number; far: number } {
  const normalizedDensity = Math.max(0, Math.min(1, fogDensity));
  if (normalizedDensity === 0) {
    return { near, far };
  }

  const fogIncrease = normalizedDensity * 0.4;
  return {
    near: near * (1 - fogIncrease),
    far: far * (1 - fogIncrease * 0.5),
  };
}
