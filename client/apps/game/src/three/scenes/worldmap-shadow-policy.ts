export function shouldCastWorldmapDirectionalShadow(shadowsEnabledByQuality: boolean, isFarView: boolean): boolean {
  return shadowsEnabledByQuality && !isFarView;
}

export function resolveWorldmapShadowMapSize(shadowMapSizeByQuality: number): number {
  return shadowMapSizeByQuality > 0 ? shadowMapSizeByQuality : 1024;
}
