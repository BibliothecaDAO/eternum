import { describe, expect, it } from "vitest";

import { buildActiveTransfersQuery } from "../torii-queries";

describe("buildActiveTransfersQuery", () => {
  it("filters to non-mint resource transfers within the requested lookback window", () => {
    const query = buildActiveTransfersQuery({
      limit: 250,
      minTimestampSeconds: 1_700_000_000,
    });

    expect(query).toContain('FROM "s1_eternum-StoryEvent"');
    expect(query).toContain("WHERE story = 'ResourceTransferStory'");
    expect(query).toContain(
      `COALESCE(CAST("story.ResourceTransferStory.is_mint" AS TEXT), '0') NOT IN ('1', 'true', 'TRUE')`,
    );
    expect(query).toContain("timestamp >= 1700000000");
    expect(query).toContain("LIMIT 250");
  });
});
