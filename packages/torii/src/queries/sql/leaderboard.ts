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
      ),
      points_story AS (
        SELECT
          lower(COALESCE("story.PointsRegisteredStory.owner_address", '')) AS player_address,
          lower(
            replace(
              replace(
                replace(trim(COALESCE("story.PointsRegisteredStory.activity", '')), 'pointsactivity::', ''),
                'pointsactivity.', ''
              ),
              'pointsactivity', ''
            )
          ) AS activity,
          lower(trim(COALESCE("story.PointsRegisteredStory.points", '0'))) AS raw_points
        FROM "s1_eternum-StoryEvent"
        WHERE story = 'PointsRegisteredStory'
          AND "story.PointsRegisteredStory.owner_address" IS NOT NULL
      ),
      points_story_prepared AS (
        SELECT
          player_address,
          activity,
          COALESCE(
            CASE
              WHEN raw_points LIKE '0x%'
                THEN substr(raw_points, 3)
              ELSE raw_points
            END,
            '0'
          ) AS normalized_points,
          CASE
            WHEN raw_points LIKE '0x%'
              THEN 1
            ELSE 0
          END AS is_hex
        FROM points_story
        WHERE player_address <> ''
          AND activity <> ''
          AND activity IS NOT NULL
          AND activity <> 'hyperstructuresharepoints'
      ),
      points_story_hex AS (
        SELECT
          player_address,
          activity,
          normalized_points AS hex_points,
          length(normalized_points) AS hex_length,
          0 AS idx,
          0 AS points
        FROM points_story_prepared
        WHERE is_hex = 1
        UNION ALL
        SELECT
          h.player_address,
          h.activity,
          h.hex_points,
          h.hex_length,
          h.idx + 1,
          h.points * 16 + CASE
            WHEN instr('0123456789abcdef', substr(h.hex_points, h.idx + 1, 1)) = 0 THEN 0
            ELSE instr('0123456789abcdef', substr(h.hex_points, h.idx + 1, 1)) - 1
          END
        FROM points_story_hex AS h
        WHERE h.idx < h.hex_length
      ),
      points_story_hex_totals AS (
        SELECT
          player_address,
          activity,
          points
        FROM points_story_hex
        WHERE idx = hex_length
      ),
      points_story_decimal AS (
        SELECT
          player_address,
          activity,
          CASE
            WHEN trim(normalized_points) = '' THEN 0
            ELSE CAST(normalized_points AS INTEGER)
          END AS points
        FROM points_story_prepared
        WHERE is_hex = 0
      ),
      points_story_combined AS (
        SELECT
          player_address,
          activity,
          points
        FROM points_story_decimal
        UNION ALL
        SELECT
          player_address,
          activity,
          points
        FROM points_story_hex_totals
      ),
      points_activity_totals AS (
        SELECT
          player_address,
          activity,
          COUNT(*) AS activity_count,
          SUM(points) AS activity_points
        FROM points_story_combined
        GROUP BY player_address, activity
      ),
      points_activity_pivot AS (
        SELECT
          player_address,
          MAX(CASE WHEN activity = 'exploration' THEN activity_points ELSE 0 END) AS exploration_points,
          MAX(CASE WHEN activity = 'exploration' THEN activity_count ELSE 0 END) AS exploration_count,
          MAX(CASE WHEN activity = 'openrelicchest' THEN activity_points ELSE 0 END) AS open_relic_chest_points,
          MAX(CASE WHEN activity = 'openrelicchest' THEN activity_count ELSE 0 END) AS open_relic_chest_count,
          MAX(CASE WHEN activity = 'hyperstructurebanditsdefeat' THEN activity_points ELSE 0 END) AS hyperstructure_bandits_defeat_points,
          MAX(CASE WHEN activity = 'hyperstructurebanditsdefeat' THEN activity_count ELSE 0 END) AS hyperstructure_bandits_defeat_count,
          MAX(CASE WHEN activity = 'otherstructurebanditsdefeat' THEN activity_points ELSE 0 END) AS other_structure_bandits_defeat_points,
          MAX(CASE WHEN activity = 'otherstructurebanditsdefeat' THEN activity_count ELSE 0 END) AS other_structure_bandits_defeat_count
        FROM points_activity_totals
        GROUP BY player_address
      )
    SELECT
      totals.player_address,
      totals.registered_points,
      totals.prize_claimed,
      COALESCE(
        NULLIF("name", 'name'),
        NULLIF("address_name.name", 'address_name.name'),
        ''
      ) AS player_name,
      COALESCE(points_activity_pivot.exploration_points, 0) AS exploration_points,
      COALESCE(points_activity_pivot.exploration_count, 0) AS exploration_count,
      COALESCE(points_activity_pivot.open_relic_chest_points, 0) AS open_relic_chest_points,
      COALESCE(points_activity_pivot.open_relic_chest_count, 0) AS open_relic_chest_count,
      COALESCE(points_activity_pivot.hyperstructure_bandits_defeat_points, 0) AS hyperstructure_bandits_defeat_points,
      COALESCE(points_activity_pivot.hyperstructure_bandits_defeat_count, 0) AS hyperstructure_bandits_defeat_count,
      COALESCE(points_activity_pivot.other_structure_bandits_defeat_points, 0) AS other_structure_bandits_defeat_points,
      COALESCE(points_activity_pivot.other_structure_bandits_defeat_count, 0) AS other_structure_bandits_defeat_count
    FROM totals
    LEFT JOIN "s1_eternum-AddressName"
      ON lower(COALESCE(
        NULLIF("address", 'address'),
        NULLIF("address_name.address", 'address_name.address'),
        ''
      )) = totals.player_address
    LEFT JOIN points_activity_pivot
      ON points_activity_pivot.player_address = totals.player_address
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
