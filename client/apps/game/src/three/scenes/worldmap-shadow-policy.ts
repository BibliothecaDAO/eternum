export function shouldCastWorldmapDirectionalShadow(shadowsEnabled: boolean, isFarView: boolean): boolean {
  return shadowsEnabled && !isFarView;
}
