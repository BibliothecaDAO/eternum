export const SEASON_QUERIES = {
  SEASON_ENDED: `
    SELECT 
        winner_address,
        timestamp
    FROM \`s1_eternum-SeasonEnded\`
    ORDER BY timestamp DESC
    LIMIT 1;
  `,
} as const;
