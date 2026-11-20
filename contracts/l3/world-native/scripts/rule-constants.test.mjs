import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  balanceIdentity,
  identifierConstants,
  readBalanceConstants,
  readLogicSlots,
  readRuleConstants,
  readReleaseConstants,
} from "./rule-constants.mjs";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);

const readSchema = async () => JSON.parse(await readFile(new URL("schema/schema.json", root), "utf8"));
const readBalanceModule = () => readFile(new URL("schema/balance.gen.ts", root), "utf8");
const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("the schema identity hashes every identifier and no tunable number", async () => {
  const { identity, ...wire } = await readSchema();
  assert.equal(sha256(wire), identity);
  const balance = await readBalanceConstants(root);
  const identifiers = identifierConstants(balance);
  assert.deepEqual(wire.identifierConstants, identifiers);
  const identifierNames = new Set(Object.values(identifiers).flatMap(Object.keys));
  assert.ok(
    ["SEASON_CLOSE", "ENTRY_OPEN", "ENTRY_ROSTER", "DISCOVER_CHESTS", "ASH_FALL", "POWER"].every((name) =>
      identifierNames.has(name),
    ),
  );
  const hashed = JSON.stringify(wire);
  const tunables = Object.values(balance)
    .flatMap(Object.keys)
    .filter((name) => !identifierNames.has(name));
  assert.ok(tunables.includes("RELIC_BLADE_BPS") && tunables.includes("POWER_DAMAGE_PERCENT"));
  for (const name of tunables) assert.equal(hashed.includes(`"${name}"`), false, name);
});

const QUANTITY =
  /_(BPS|PERCENT|STAMINA|PER_[A-Z]+|FRAGMENTS|LIMIT|CAP|SHARE|COUNT|SIZE|SECONDS|PLAYERS|LEVEL|STEPS|BASE|SLOTS|RINGS|COST|AMOUNT|RATE|MAX|MIN|BELOW|ABOVE|UNDER|OVER|THRESHOLD)$/;
const HASHED_QUANTITIES = [
  "rule.MAX_BLITZ_ROSTER_PLAYERS",
  "rule.FRONTIER_REPORT_GRACE_SECONDS",
  "rule.DEEP_MAP_SIZE",
  "rule.DEEP_KIND_COUNT",
  "rule.DEEP_GUARD_SLOTS",
  "quest.QUEST_COUNT",
  "race.STAGE_COUNT",
  "arrival.SLOTS_PER_DAY",
  "research.RANGE_LEVEL",
  "research.CONSCRIPTION_CAMP_LEVEL",
  "research.RATIONS_DEPOT_LEVEL",
  "research.SCOUTS_LODGE_LEVEL",
];

test("every constant is either a hashed identifier or a tunable number, and a quantity-named identifier is named here", async () => {
  const balance = await readBalanceConstants(root);
  const identifiers = identifierConstants(balance);
  const hashed = Object.entries(identifiers).flatMap(([group, constants]) =>
    Object.keys(constants).map((name) => `${group}.${name}`),
  );
  const tunable = Object.values(balance).flatMap((constants) =>
    Object.keys(constants).filter((name) => !Object.values(identifiers).some((ids) => Object.hasOwn(ids, name))),
  );
  assert.equal(hashed.length + tunable.length, Object.values(balance).flatMap(Object.keys).length);
  for (const name of tunable) assert.match(name, QUANTITY, `${name} is tunable without a unit`);
  assert.deepEqual(
    hashed.filter((name) => QUANTITY.test(name.split(".")[1])),
    HASHED_QUANTITIES,
    "a constant named like a quantity is hashed: rename it with a unit to make it tunable, or list it as an identifier",
  );
});

test("the published logic slots are the slots src/slots.cairo numbers, in their order", async () => {
  const slots = await readLogicSlots(root);
  assert.deepEqual(slots[0], { slot: 0, name: "season", contract: "SeasonLogic" });
  assert.deepEqual((await readSchema()).logicClasses, slots);
});

test("the game families the contract names are the families every reader is generated with", async () => {
  const families = (await readBalanceConstants(root)).nativeFamilyConstants;
  assert.deepEqual(families, { FRONTIER: 1, BLITZ: 2 });
  assert.deepEqual(identifierConstants(await readBalanceConstants(root)).family, families);
  const schemaModule = await readFile(new URL("schema/client.gen.ts", root), "utf8");
  for (const [name, id] of Object.entries(families)) assert.match(schemaModule, new RegExp(`"${name}": ${id}`));
});

test("the balance identity moves with a tunable number only, not with a rename or an identifier", () => {
  const balance = {
    nativeOathConstants: { POWER: 12, SKILL_BELOW_STAMINA: 10, POWER_DAMAGE_PERCENT: 20 },
  };
  const identity = balanceIdentity(balance);
  const renamed = { ...balance, nativeOathConstants: { POWER: 12, SKILL_UNDER_STAMINA: 10, POWER_DAMAGE_PERCENT: 20 } };
  assert.equal(balanceIdentity(renamed), identity);
  const identifier = { ...balance, nativeOathConstants: { ...balance.nativeOathConstants, POWER: 13 } };
  assert.equal(balanceIdentity(identifier), identity);
  const tuned = { ...balance, nativeOathConstants: { ...balance.nativeOathConstants, POWER_DAMAGE_PERCENT: 25 } };
  assert.notEqual(balanceIdentity(tuned), identity);
  const swapped = { ...balance, nativeOathConstants: { POWER: 12, SKILL_BELOW_STAMINA: 20, POWER_DAMAGE_PERCENT: 10 } };
  assert.notEqual(balanceIdentity(swapped), identity);
});

test("the balance module publishes the identity of the numbers it carries", async () => {
  assert.match(
    await readBalanceModule(),
    new RegExp(`^export const nativeBalanceIdentity = "${balanceIdentity(await readBalanceConstants(root))}";$`, "m"),
  );
});

test("a wire change changes the schema identity", async () => {
  const { identity, ...wire } = await readSchema();
  const changed = structuredClone(wire);
  changed.models[0].members[0].type = "core::integer::u8";
  assert.notEqual(sha256(changed), identity);
});

test("native roster constants publish their rule values in the generated balance module", async () => {
  const rules = await readRuleConstants(root);
  const balance = await readBalanceModule();
  for (const [name, value] of Object.entries(rules))
    assert.match(balance, new RegExp(`^  "?${name}"?: ${value},?$`, "m"));
  const shared = await readFile(new URL("src/roster_limits.cairo", root), "utf8");
  const value = shared.match(/^pub const MAX_BLITZ_ROSTER_PLAYERS: u32 = ([0-9]+);$/m);
  assert.ok(value, "missing shared MAX_BLITZ_ROSTER_PLAYERS");
  assert.equal(rules.MAX_BLITZ_ROSTER_PLAYERS, Number(value[1]));
});

test("a missing shared rule refuses schema generation instead of becoming a silent zero", async () => {
  const directory = await mkdtemp(join(tmpdir(), "roster-rule-test-"));
  try {
    await mkdir(join(directory, "src"));
    await writeFile(join(directory, "src/rules.cairo"), "pub const MAX: u32 = crate::roster_limits::MISSING;\n");
    await writeFile(join(directory, "src/roster_limits.cairo"), "pub const MAX_BLITZ_ROSTER_PLAYERS: u32 = 24;\n");
    await writeFile(
      join(directory, "src/day_schedule.cairo"),
      "pub const FRONTIER_REPORT_GRACE_SECONDS: u32 = 3600;\n",
    );
    await assert.rejects(readRuleConstants(pathToFileURL(directory + sep)), /Unknown shared rule constant MISSING/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the withdrawal reporting grace is shared with the ledger and exported to clients", async () => {
  const rules = await readRuleConstants(root);
  assert.equal(rules.FRONTIER_REPORT_GRACE_SECONDS, 3600);
  assert.equal(
    await realpath(new URL("src/day_schedule.cairo", root)),
    await realpath(new URL("../../l2/ledger/src/days.cairo", root)),
  );
});

test("release thresholds are generated for every reader, decoders included, in the schema module and not the balance module", async () => {
  const constants = await readReleaseConstants(root);
  const schemaModule = await readFile(new URL("schema/client.gen.ts", root), "utf8");
  for (const [name, release] of Object.entries(constants)) {
    assert.match(name, /_RELEASE$/, `${name} gates a release`);
    assert.match(schemaModule, new RegExp(`"${name}": ${release}`));
  }
  assert.doesNotMatch(await readBalanceModule(), /_RELEASE"/);
});

test("every release threshold is a release this commit ships or an earlier one", async () => {
  const shipped = (await readFile(new URL("../../../deploy/release/native-release.ts", root), "utf8")).match(
    /^  frontier: \{ family: [^,]+, release: ([0-9]+), since: [0-9]+ \},$/m,
  );
  assert.ok(shipped, "missing the Frontier release line");
  for (const [name, release] of Object.entries(await readReleaseConstants(root)))
    assert.ok(release <= Number(shipped[1]), `${name} is release ${release}, after the release this commit ships`);
});
