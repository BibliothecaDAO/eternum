import { readdirSync, readFileSync } from "node:fs";
import { Miniflare } from "miniflare";

/** A D1 database in workerd with the launch migrations applied, as `wrangler d1 migrations apply` would. */
export async function createLaunchTestDatabase() {
  const mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: ["DB"] });
  const db = (await mf.getD1Database("DB")) as unknown as D1Database;
  await db.batch(migrationStatements().map((statement) => db.prepare(statement)));
  return { db, close: () => mf.dispose() };
}

const migrationStatements = (): string[] => {
  const migrations = new URL("../migrations/", import.meta.url);
  return readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8"))
    .join(";\n")
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
};

/** The chain a test store keys its runs under, as a shard's /manifest would name it. */
export const TEST_CHAIN = "0x534e5f5445535f5348415244";
export const testChain =
  (chainId = TEST_CHAIN) =>
  async () =>
    chainId;

/** Save and complete a game fixture through the same durable summary path. */
export const completeFreeFixture = async (
  store: import("./store").D1LaunchStore,
  runId: string,
  summary: import("./model").LaunchSummary,
) => {
  if ("startTime" in summary) {
    await store.saveGame(summary);
  }
  await store.complete(runId, summary);
};

export const slotValueFixture = (count = 0) => ({
  openSlot: async () => {},
  refundSlot: async () => null,
  markRefundable: async () => {},
  registrations: async () => ({
    slot: {
      exists: true,
      seasonId: 1,
      presetId: 1,
      close: 100,
      end: 160,
      pool: "0",
      registeredCount: count,
      cancelled: false,
    },
    blockNumber: 10,
    blockHash: "0xabc",
    secondsUntilClose: 0,
    next: null,
    registrations: Array.from({ length: count }, (_, i) => ({ wallet: `0x${(i + 1).toString(16)}`, registeredAt: 90 })),
  }),
});
export const registrationIdentityFixture = {
  accountsAtRegistration: async (page: readonly { wallet: string }[]) =>
    page.map(({ wallet }) => `0x${(BigInt(wallet) + 100n).toString(16)}`),
};
