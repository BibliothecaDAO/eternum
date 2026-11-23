function clampScalar(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function resolveTripoPbr(input, spec) {
  const baseRoughness =
    !input.hasRoughnessMap && input.roughness > spec.roughness.fallbackThreshold
      ? spec.roughness.default
      : input.roughness;
  const roughness = clampScalar(baseRoughness, spec.roughness.min, spec.roughness.max);

  const baseMetalness =
    !input.hasMetalnessMap && input.metalness <= spec.metalness.fallbackThreshold
      ? spec.metalness.default
      : input.metalness;
  const metalness = clampScalar(baseMetalness, spec.metalness.min, spec.metalness.max);

  const normalScaleX = input.hasNormalMap
    ? clampScalar(Math.abs(input.normalScaleX), spec.normal.minScale, spec.normal.scale)
    : null;
  const normalScaleY = input.hasNormalMap
    ? clampScalar(Math.abs(input.normalScaleY), spec.normal.minScale, spec.normal.scale)
    : null;

  const hasEmissiveAccent = Boolean(input.hasEmissiveMap) || input.emissivePeak >= spec.emissive.structuralEpsilon;
  const emissiveIntensity = hasEmissiveAccent ? clampScalar(input.emissiveIntensity, 0, spec.emissive.maxIntensity) : 0;

  return {
    doubleSided: spec.doubleSided,
    roughness,
    metalness,
    normalScaleX,
    normalScaleY,
    aoMapIntensity: spec.ambientOcclusion.mapIntensity,
    hasEmissiveAccent,
    emissiveIntensity,
  };
}
