export const playableDepths = (preset) => (preset.deep ? preset.depths.slice(0, -1) : preset.depths);
