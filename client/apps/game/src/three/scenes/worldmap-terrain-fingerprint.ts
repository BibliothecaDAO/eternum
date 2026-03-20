interface TerrainFingerprintEntry {
  hexKey: string;
  biomeKey: string;
}

export function createWorldmapTerrainFingerprint(entries: Iterable<TerrainFingerprintEntry>): string {
  return Array.from(entries)
    .map((entry) => `${entry.hexKey}:${entry.biomeKey}`)
    .sort()
    .join("|");
}
