export function shouldCastWorldmapDirectionalShadow(shadowsEnabledByQuality: boolean, isFarView: boolean): boolean {
  return shadowsEnabledByQuality && !isFarView;
}
