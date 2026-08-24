import { pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { getRelationalSchema } from "./drizzle-schema";

describe("getRelationalSchema", () => {
  it("exposes the table metadata expected by Apibara's Drizzle plugin", () => {
    const bridgeEvents = pgTable("bridge_events", {
      _id: text("_id").notNull(),
    });
    const rewards = pgTable("rewards", {
      _id: text("_id").notNull(),
    });

    const schema = getRelationalSchema({ bridgeEvents, rewards });

    expect(schema.bridgeEvents.dbName).toBe("bridge_events");
    expect(schema.rewards.dbName).toBe("rewards");
    expect(Object.keys(schema.bridgeEvents.columns)).toContain("_id");
    expect(Object.keys(schema.rewards.columns)).toContain("_id");
  });
});
