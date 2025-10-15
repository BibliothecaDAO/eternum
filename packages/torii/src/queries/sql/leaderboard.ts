const PLAYER_LEADERBOARD_BASE = `
    WITH RECURSIVE
      registered AS (
        SELECT
          lower(COALESCE(
            NULLIF("address", 'address'),
            NULLIF("player_registered_points.address", 'player_registered_points.address'),
            ''
          )) AS player_address,
          CASE
            WHEN lower(COALESCE(
              NULLIF("registered_points", 'registered_points'),
              NULLIF("player_registered_points.registered_points", 'player_registered_points.registered_points'),
              '0x0'
            )) LIKE '0x%'
            THEN substr(lower(COALESCE(
              NULLIF("registered_points", 'registered_points'),
              NULLIF("player_registered_points.registered_points", 'player_registered_points.registered_points'),
              '0x0'
            )), 3)
            ELSE lower(COALESCE(
              NULLIF("registered_points", 'registered_points'),
              NULLIF("player_registered_points.registered_points", 'player_registered_points.registered_points'),
              '0x0'
            ))
          END AS hex_points,
          COALESCE(
            NULLIF("prize_claimed", 'prize_claimed'),
            NULLIF("player_registered_points.prize_claimed", 'player_registered_points.prize_claimed'),
            0
          ) AS prize_claimed
        FROM "s1_eternum-PlayerRegisteredPoints"
      ),
      decoded AS (
        SELECT
          player_address,
          hex_points,
          prize_claimed,
          length(hex_points) AS hex_length,
          0 AS idx,
          0 AS points
        FROM registered
        UNION ALL
        SELECT
          d.player_address,
          d.hex_points,
          d.prize_claimed,
          d.hex_length,
          d.idx + 1,
          d.points * 16 + CASE
            WHEN instr('0123456789abcdef', substr(d.hex_points, d.idx + 1, 1)) = 0 THEN 0
            ELSE instr('0123456789abcdef', substr(d.hex_points, d.idx + 1, 1)) - 1
          END
        FROM decoded AS d
        WHERE d.idx < d.hex_length
      ),
      totals AS (
        SELECT
          player_address,
          prize_claimed,
          points AS registered_points
        FROM decoded
        WHERE idx = hex_length
      )
    SELECT
      totals.player_address,
      totals.registered_points,
      totals.prize_claimed,
      COALESCE(
        NULLIF("name", 'name'),
        NULLIF("address_name.name", 'address_name.name'),
        ''
      ) AS player_name
    FROM totals
    LEFT JOIN "s1_eternum-AddressName"
      ON lower(COALESCE(
        NULLIF("address", 'address'),
        NULLIF("address_name.address", 'address_name.address'),
        ''
      )) = totals.player_address
`;

export const LEADERBOARD_QUERIES = {
  PLAYER_LEADERBOARD: `
    ${PLAYER_LEADERBOARD_BASE}
    ORDER BY registered_points DESC, totals.player_address
    LIMIT {limit}
    OFFSET {offset};
  `,
  PLAYER_LEADERBOARD_ALL: `
    ${PLAYER_LEADERBOARD_BASE}
    ORDER BY registered_points DESC, totals.player_address;
  `,
  PLAYER_LEADERBOARD_BY_ADDRESS: `
    ${PLAYER_LEADERBOARD_BASE}
    WHERE totals.player_address = lower('{playerAddress}')
    LIMIT 1;
  `,
  HYPERSTRUCTURE_LEADERBOARD_CONFIG: `
    SELECT
      "victory_points_grant_config.hyp_points_per_second" AS points_per_second,
      "season_config.end_at" AS season_end,
      COALESCE("realm_count_config.count", 0) AS realm_count
    FROM "s1_eternum-WorldConfig";
  `,
  HYPERSTRUCTURE_SHAREHOLDERS: `
    SELECT
      hyperstructure_id,
      start_at,
      shareholders
    FROM "s1_eternum-HyperstructureShareholders";
  `,
  HYPERSTRUCTURES_WITH_MULTIPLIER: `
    SELECT
      hyperstructure_id,
      points_multiplier
    FROM "s1_eternum-Hyperstructure";
  `,
} as const;

export const PLAYER_LEADERBOARD_QUERY = LEADERBOARD_QUERIES.PLAYER_LEADERBOARD;
