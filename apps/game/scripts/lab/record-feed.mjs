/**
 * Records the Feed lab's window of prod's Frontier history from one of perf's live-data pulls (public data, read-only):
 * the newest 350 stories, the World feed's own read, newest first, as Herald serves them; the public names of the
 * players they name; and the facts the story words read, as Herald rows: the game's rules, each named realm's Structure
 * (from that player's snapshot) and each fought site's ExpeditionSite, rebuilt from the pull's own fights and clears
 * (where it stands, its first guard, its kind). A site the pull never fought or cleared has no row, so its find reads
 * "Explored" here.
 *
 *   pnpm --dir apps/game record:feed <pull-dir> <viewer-address> <out.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WINDOW = 350;
const RULE_MODELS = ["SliceRules", "GameRegistry", "SettlementRules", "DepthRules"];

const [pullDir, viewer, out] = process.argv.slice(2);
if (!pullDir || !viewer || !out) throw new Error("Usage: record-feed.mjs <pull-dir> <viewer-address> <out.json>");
const read = (name) => JSON.parse(readFileSync(join(pullDir, name), "utf8"));

const kindOf = (item) => (item.model === "StoryEvent" ? Object.keys(item.value.story)[0] : item.model);
const payloadOf = (item) => (item.model === "StoryEvent" ? item.value.story[kindOf(item)] : item.value);
const ownerOf = (item) => item.value.owner ?? item.value.player ?? item.value.attacker?.player ?? null;
const newestFirst = (a, b) =>
  b.block_number - a.block_number || b.transaction_index - a.transaction_index || b.event_index - a.event_index;

const pulled = read("pulled.json");
const all = read("history.json").items.sort(newestFirst);
const history = all.slice(0, WINDOW);

/** Each named player's public name, as the identity service gives it. */
const names = read("names.json");
const players = [...new Set(history.map(ownerOf).filter(Boolean))];
const named = Object.fromEntries(
  players.filter((address) => names[address]).map((address) => [address, names[address]]),
);

const rules = read("rules.json")
  .models.filter(({ model }) => RULE_MODELS.includes(model))
  .flatMap(({ model, rows }) => rows.map((row) => ({ model, key: row.key, value: row.value })));

/** Every realm the pull holds, by entity id, from its player's snapshot. */
const realms = new Map(
  Object.values(read("players.json")).flatMap((snapshot) =>
    (snapshot.models.Structure ?? []).map((row) => [BigInt(row.value.entity_id), row]),
  ),
);
const namedRealms = new Set(
  history.flatMap((item) => {
    const payload = payloadOf(item);
    return [payload.structure_id, payload.receiver, item.value.entity_id, item.value.attacker_owner]
      .filter((id) => id !== undefined && id !== null)
      .map((id) => BigInt(id));
  }),
);
const structures = [...namedRealms]
  .filter((id) => realms.has(id))
  .map((id) => ({ model: "Structure", key: realms.get(id).key, value: realms.get(id).value }));

/** A site where it was first fought (place and first guard), and its kind from its clear. */
// Fights first, then clears: a clear's payout may come before its last fight within one transaction.
const sites = new Map();
for (const item of [...all].reverse().filter((each) => kindOf(each) === "BattleEvent")) {
  const fight = payloadOf(item);
  if (BigInt(fight.defender_owner) === 0n && !sites.has(BigInt(fight.defender_id)))
    sites.set(BigInt(fight.defender_id), { coord: fight.coord, guard: fight.defender.before, category: null });
}
for (const item of all.filter((each) => kindOf(each) === "SitePayout")) {
  const clear = payloadOf(item);
  if (sites.has(BigInt(clear.site_id))) sites.get(BigInt(clear.site_id)).category = clear.category;
}
const game = BigInt(history[0].value.game_id ?? history[0].game_id);
const siteRows = [...sites]
  .filter(([, site]) => site.category !== null)
  .map(([id, site]) => ({
    model: "ExpeditionSite",
    key: `0x${game.toString(16)}:0x${id.toString(16)}`,
    value: {
      game_id: `0x${game.toString(16)}`,
      entity_id: `0x${id.toString(16)}`,
      category: site.category,
      initial_guard_count: site.guard,
      alt: site.coord.alt,
      col: site.coord.x,
      row: site.coord.y,
      clear: null,
    },
  }));

writeFileSync(
  out,
  `${JSON.stringify({ pulledAt: pulled.at, viewer, names: named, facts: [...rules, ...structures, ...siteRows], history })}\n`,
);
console.log(
  `Wrote ${out}: ${history.length} stories, ${players.length} players (${Object.keys(named).length} named), ` +
    `${structures.length} realms, ${siteRows.length} sites, ${rules.length} rule rows`,
);
