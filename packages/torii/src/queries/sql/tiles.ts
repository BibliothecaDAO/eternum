export const TILES_QUERIES = {
  ALL_TILES: `
    SELECT DISTINCT
        col,
        row,
        biome,
        occupier_id,
        occupier_type,
        occupier_is_structure
    FROM \`s1_eternum-Tile\`
    ORDER BY col, row;
  `,
} as const;
