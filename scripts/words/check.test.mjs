import assert from "node:assert/strict";
import { test } from "node:test";

import { scanSource } from "./check.mjs";

const context = {
  nouns: new Set(["Wheat", "Knight", "City"]),
  voiceRules: [
    { rule: "Points are points", forbidden: /\b(?:VP|[Pp]ts)\b/ },
    { rule: "A rank by its name", forbidden: /\b(?:Level|Lvl|Lv\.?) ?\d/ },
  ],
};
const scan = (source, fileName = "/repo/apps/game/src/ui/features/probe/probe.tsx") =>
  scanSource(source, fileName, context).map(({ category, line }) => `${line} ${category}`);

test("finds each kind of number, time and naming work a player reads, and the function that does it", () => {
  const source = [
    "const formatGold = (n: number) => n.toLocaleString();", // 1
    "const compact = new Intl.NumberFormat('en-US');", // 2
    "const clock = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m`;", // 3
    "const big = (n: number) => `${(n / 1_000).toFixed(1)}K`;", // 4
    "const when = (d: Date) => d.toLocaleTimeString();", // 5
    "const label = <b>{ResourcesIds[id]}</b>;", // 6
    "const name = <i title={findResourceById(id)?.trait} />;", // 7
    "const rank = <b>{RealmLevelNames.City}</b>;", // 8
    "const crop = <span>Wheat</span>;", // 9
    "const rate = `+${amount}/h`;", // 10
    "const tip = <p>{amount} points/s</p>;", // 11
    "const share = <p>{Math.round(share * 100)}%</p>;", // 12
    "const ago = `${minutes} min ago`;", // 13
    'const label = findResourceById(id)?.trait ?? "";', // 14: a name through a variable
    "const wall = GUARD_SLOT_NAMES[slot];", // 15
    "const mine = getMinePresentation(kind).name;", // 16
    "const tip = <b data-tip={`${ResourcesIds[id]} — need 5`} />;", // 17: a tooltip is read
    "const paid = parseFloat(shown.replace(/,/g, ''));", // 18: a written figure parsed back
    "const cost = Number(formatAmount(raw));", // 19
    // 20-25: the faith panel's own bigint grouping, as it stood
    "const formatBigInt = (value: bigint): string => {",
    "  const sign = value < 0n ? '-' : '';",
    "  const digits = (value < 0n ? -value : value).toString();",
    "  const grouped = digits.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');",
    "  return `${sign}${grouped}`;",
    "};",
    "const score = <p>{formatAmount(player.points)}</p>;", // 26: points by the compact rule
    "const line = `${formatAmount(total)} points`;", // 27
    "const held = formatCharge(divideByPrecision(raw));", // 28: floored, so 0.5 reads 0, never 0.5
    'import { formatExact } from "@/ui/design-system/kit/amount";', // 29: a retired words file
    'export { siteName } from "../../../three/map-plates/site-name";', // 30
    "const pool = <p>{formatAmount(divideByPrecision(total))}</p>;", // 31: divideByPrecision floors by default
    // 32: the top bar as it shipped in 7ba1001dc0c (identity-chip.tsx), which read "35 points points"
    '<span key="points">{formatPoints(standing.points)} points</span>,',
    "const since = <p>{formatAgo(at)} ago</p>;", // 33
    "const wait = formatWait(left) + ' seconds';", // 34
    'const held = `${formatCount(n, "relic")} relics`;', // 35
    "const done = <p>{formatGameClock(s)}{' '}min</p>;", // 36
    'const slots = `${n} ${n === 1 ? "slot" : "slots"}`;', // 37: a plural picked by hand
    'const line = `${n} building${n !== 1 ? "s" : ""}`;', // 38
    'const armyLabel = count > 1 ? "armies" : "army";', // 39
    'const verb = `${n} ${n === 1 ? "is" : "are"} in use`;', // 40
    // 41: the deploy sheet as it shipped in 7ba1001dc0c (army-type-toggle.tsx), which read "All 1 field army slots"
    "const limitMessage = armyType ? `All ${maxExplorers} field army slots are in use.` : '';",
    'const exchanges = (count: number) => (count === 1 ? "1 exchange" : `${count} exchanges`);', // 42
    "const bonusLabel = `${bonusPercent > 0 ? '+' : ''}${bonusPercent}%`;", // 43: words held in a named value
    "const row = <Row detail={`${rows.length} buildings`} />;", // 44
    // 45: the Play card as it shipped in 26932d66b75 (play-item.tsx), which read "1 Players" (qa-app-2 P3-12)
    "const chip = <Chip>{`${formatAmount(game.player_count)} ${PLAY_WORDS.players}`}</Chip>;",
    // 46-48: costs as they shipped in 549586f46ea (army-sheet, build-sheet, army-token), each by its own writer
    "const tier = <p>{formatExact(price)} {XP}</p>;",
    "const takes = takesPopulation(formatAmount(option.populationCost));",
    "const fee = `${formatExact(lpFee)} LORDS`;",
    // 49-50: cost pairs as they shipped in 1823bab5b9c (order-bar, chip): "28 / 28" for 28.10 of 28.15
    "const chip = <b>{`${formatAmount(held)} / ${formatCharge(cost)}`}</b>;",
    "const row = <span>{formatAmount(held)} / {formatCharge(req.amount)}</span>;",
  ].join("\n");
  assert.deepEqual(scan(source), [
    "1 formatter",
    "1 number.locale",
    "2 number.intl",
    "3 formatter",
    "3 time.units",
    "4 formatter",
    "4 number.suffix",
    "4 number.fixed",
    "5 formatter",
    "5 time.locale",
    "6 name.enumKey",
    "7 name.trait",
    "8 name.table",
    "9 name.literal",
    "10 number.rate",
    "11 number.rate",
    "12 number.percent",
    "13 time.ago",
    "14 name.trait",
    "15 name.table",
    "16 name.table",
    "17 name.enumKey",
    "18 number.parse",
    "19 number.parse",
    "20 formatter",
    "23 number.grouping",
    "26 number.points",
    "27 number.points",
    "28 number.floored",
    "29 retired",
    "30 retired",
    "31 number.floored",
    "32 words.doubled",
    "33 words.doubled",
    "34 words.doubled",
    "35 words.doubled",
    "36 words.doubled",
    "37 number.plural",
    "38 number.plural",
    "39 number.plural",
    "40 number.plural",
    "41 number.plural",
    "41 words.long",
    "42 number.plural",
    "43 number.percent",
    "44 number.plural",
    "45 number.plural",
    "46 number.charge",
    "47 number.charge",
    "48 number.charge",
    "49 number.pair",
    "50 number.pair",
  ]);
});

test("finds a realm's population written by hand, any way but the words module's", () => {
  const source = [
    // 1: the Build panel as it shipped in 75665e7370e (build-view.tsx), which read free of capacity, "1 / 6"
    "const chip = <HudChip>{`${formatExact(population.free)} / ${formatExact(population.total)}`}</HudChip>;",
    // 2: a Hut's upgrade figure as it shipped in 75665e7370e (type-upgrade.tsx)
    "const figure = { value: `${formatAmount(total - people.current)} / ${formatAmount(total)}` };",
    "const tip = <span data-tip={`Population ${formatExact(holding.population)} of ${holding.populationCapacity}`} />;", // 3
    "const row = <p>{structure.population}/{structure.populationCapacity}</p>;", // 4
    "const free = `${population.free} free of ${population.total}`;", // 5
    // 6: the Frontier realm panel's tooltip as it shipped in 75665e7370e (realm-panel.tsx)
    "const tip = <span data-tip={`Population ${formatExact(used)} of ${formatExact(total)}`} />;",
    // Left alone: the words module's writer, a cost, a step, and a store's amount against its limit.
    "const chip = <p>{formatPopulation(used, total)}</p>;",
    "const cost = `Cost +${populationCost}`;",
    "const step = `${formatAmount(population(tier))} → ${formatAmount(population(tier + 1))}`;",
    "const store = `${formatAmount(held)} / ${formatAmount(limit)}`;",
  ].join("\n");
  assert.deepEqual(scan(source), [
    "1 number.population",
    "2 number.population",
    "3 number.population",
    "4 number.population",
    "5 number.population",
    "6 number.population",
  ]);
});

test("checks the voice only in what a player reads", () => {
  const source = [
    "export const Score = () => <p title='+250 VP'>Level 2</p>;", // 1
    "const key = 'Level 2';", // 2: a value a player may read
    "const css = <div className='pts-2 lvl-3' data-kind='VP' />;", // 3: code
    "if (mode === 'Level 2') {}", // 4: a comparison is code
    "const tag = `Level ${level}`;", // 5
    "const card = `${points} Pts`;", // 6
  ].join("\n");
  assert.deepEqual(scan(source), [
    "1 voice: Points are points",
    "1 voice: A rank by its name",
    "2 voice: A rank by its name",
    "5 voice: A rank by its name",
    "6 voice: Points are points",
  ]);
});

test("leaves code alone: arithmetic, coordinates, logs, CSS, keys and components", () => {
  const source = [
    "const round = (n: number) => Number(n.toFixed(3));",
    "const digits = (p: number) => p.toFixed(6).split('.');",
    "const path = `M ${x.toFixed(1)} ${y.toFixed(1)} L 0 0`;",
    "const points = `${x.toFixed(2)},${y.toFixed(2)}`;",
    "console.info(`took ${ms.toFixed(1)}ms`);",
    "verboseLog(`sharing=${ratio.toFixed(1)}:1`);",
    "const bar = <div style={{ width: `${share * 100}%` }} />;",
    "const icon = <ResourceIcon resource={ResourcesIds[id]} />;",
    "const slot = GuardSlot[label as keyof typeof GuardSlot];",
    "const model = { [RealmLevelNames.City]: 'realm-1' };",
    "const probe = <b data-testid={`${ResourcesIds[id]}-row`} />;",
    "const hex = parseInt(address.replace(/^0x/, ''), 16);",
    "const typed = Number(event.target.value);",
    "const held = <p>{formatAmount(wheat)} wheat</p>;",
    "const max = knownAmount(raw) ?? 0;",
    'import { formatAmount } from "@bibliothecadao/types";',
    "const troops = formatExact(divideByPrecision(raw));",
    "const exact = formatAmount(divideByPrecision(raw, false));",
    'import { AmountSlider } from "@/ui/design-system/kit/amount-slider";',
    "const byName = { [ResourcesIds[id]]: 1 };",
    "export function GoldRow({ n }) { return <span>{n}</span>; }",
    "if (troop === 'Knight') {}",
    "const top = <p>#{rank} · {formatPoints(points)}</p>;",
    "const cost = <p>{formatCharge(option.populationCost)}</p>;",
    "const each = <p>at {formatFigure(offer.price)} LORDS each</p>;",
    "const fed = <p>{formatAmount(feedCount)}</p>;",
    "const after = <p>{formatExact(held - price)}</p>;",
    "const held = <p>{formatExact(Math.floor(cost.held))}</p>;",
    "const bar = <p>{formatExact(stamina.current)} / {formatExact(stamina.max)}</p>;",
    "const pair = <p>{heldAgainstNeed(held, cost)}</p>;",
    "const left = `${formatDuration(s)} left`;",
    "const more = <p>{formatWait(s)} more</p>;",
    'const held = `${formatCount(n, "relic")} held`;',
    'const mode = count === 1 ? "single" : "split";',
    'const pick = n === 1 ? "solo" : "solos" + suffix;',
    "throw new Error(`${slots} slots × ${pool.count} pool instances`);",
    "let html = `<h2>Palette (${playerCount} players)</h2>`;",
    "const key = `${rows.length} rows`;",
    // A route, a key or a diagnostic picked by count is code: formatCount would write a count into it.
    'const route = n === 1 ? "/realm" : "/realms";',
    'const key = count === 1 ? "army" : "armies";',
    'console.log(count === 1 ? "request" : "requests");',
    'throw new Error(count === 1 ? "invalid record" : "invalid records");',
    'throw new Error(count === 1 ? "1 invalid record" : `${count} invalid records`);',
  ].join("\n");
  assert.deepEqual(scan(source), []);
});

test("finds an amount put into text as it is, and passes text, nodes and words tables named for one", () => {
  const source = [
    // 1-2: the raid result and the LORDS withdrawal story as they shipped in 5bdc22683e6
    '<span className="text-hud-good">{resource.amount}</span>;',
    "const story = { description: `${amount} LORDS to L2` };",
    "const tip = <b title={`Needs ${cost} stamina`} />;", // 3
    // 4-8: the same raw amounts through a wrapper that passes them on unchanged
    "const row = <span>{(resource.amount)}</span>;",
    "const row = <span>{resource.amount ?? 0}</span>;",
    "const story = { description: `${(amount)} LORDS to L2` };",
    "const story = { description: `${shown ? amount : '—'} LORDS` };",
    "const Price = (props: { price: number }) => <span>{props.price}</span>;",
    // Written already, or a node: passes.
    "const story = { description: `${formatCharge(amount)} LORDS to L2` };",
    "const price = <span>{price}</span>;",
    "const title = <p>{PROFILE_WORDS.removeCost}</p>;",
    "const tip = <b title={`${amountText} wheat`} />;",
    "const key = `${resource.amount}-${index}`;",
    "function paid(raw) { const cost = formatCharge(raw); return { description: `Paid ${cost}` }; }",
    "function paid(payload) { const cost = formatResourceList(payload.cost); return { description: `Paid ${cost}` }; }",
    "const Price = (props: { price: ReactNode }) => <span>{props.price}</span>;",
    "const Fee = ({ fee }: { fee: string }) => <b title={`Fee ${fee}`} />;",
    "const story = { description: `${shown ? formatCharge(amount) : '—'} LORDS` };",
  ].join("\n");
  assert.deepEqual(scan(source), [
    "1 number.bare",
    "2 number.bare",
    "3 number.bare",
    "4 number.bare",
    "5 number.bare",
    "6 number.bare",
    "7 number.bare",
    "8 number.bare",
  ]);
});

test("finds a least amount to type written as a charge, in text a player reads, and passes it written as typed", () => {
  const source = [
    // 1: the production minimum as it shipped in 16e0f6e6a76 and 8ca6d70a7e7, which read "Spend at least <1 Copper"
    "const story = { reason: `Spend at least ${formatCharge(fromUnits(least))} ${resourceName(resource)}` };",
    "const story = { reason: `Needs at least ${formatAmount(least)} wheat` };", // 2
    // 3-5: the same minimum through a wrapper that passes the figure on, and in ordinary JSX
    "const story = { reason: `Spend at least ${(formatCharge(fromUnits(least)))} Copper` };",
    "const line = <p>Spend at least {formatCharge(fromUnits(least))} {resourceName(resource)}</p>;",
    'const line = <p>{"Spend at least "}{formatAmount(least)} Copper</p>;',
    // Written as typed, an ordinary charge, a log and an attribute no player reads: passes.
    "const story = { reason: `Spend at least ${formatTypedNumber(fromUnits(least))} ${resourceName(resource)}` };",
    "const line = <p>Spend at least {formatTypedNumber(fromUnits(least))} Copper</p>;",
    "const story = { reason: `Needs ${formatCharge(cost)} wheat` };",
    "console.info(`probe: at least ${formatCharge(least)}`);",
    "const probe = <p data-testid={`at least ${formatCharge(least)}`} />;",
  ].join("\n");
  assert.deepEqual(scan(source), [
    "1 number.threshold",
    "2 number.threshold",
    "3 number.threshold",
    "4 number.threshold",
    "5 number.threshold",
  ]);
});

test("keeps CSS transition durations out of player words while checking visible durations", () => {
  const source = [
    "const fade = <div style={{ transitionDuration: `${black.seconds}s` }} />;",
    "const label = <span>{`${black.seconds}s`}</span>;",
    "const tip = <span title={`${black.seconds}s`} />;",
  ].join("\n");
  assert.deepEqual(scan(source), ["2 time.units", "3 time.units"]);
});

test("finds a formula a player would read, in a string or across JSX, and leaves counts and gains alone", async () => {
  const { VOICE_RULES } = await import("@bibliothecadao/types");
  const formula = VOICE_RULES.find(({ rule }) => rule === "A number, never a formula");
  const rules = { ...context, voiceRules: [formula] };
  const source = [
    // 1-4: what the owner read on the building card and the research tree (10-26), and the price arrow on next
    "export const researchBasis = (base: string, share: string, side: string) => `${base} + ${share} ${side}`;",
    "const line = <p>{standing} × {each}</p>;",
    "export const priceRaised = (base: string, noun: string, times: string, standing: string) =>",
    "  `Base ${base} ${noun}, ×${times} with ${standing} standing`;",
    "const price = `1 ${name} = ${formatFigure(price)} ${LORDS}`;", // 5: a price as an equation
    "const total = <p>{a} + {b}</p>;", // 6
    // 7-13: what stays: counts, multiples, gains, a figure against its most, a key chord, a price each
    "const held = `Credit ×${count}`;",
    'const sword = "Win ×2";',
    "const entry = `${shares}× entry until ${date}`;",
    "const gain = `+25/min · +25% from Fields`;",
    "const store = `${held} / ${most}`;",
    "const keys = `${modifiers}+${key}`;",
    "const each = `${price} ${LORDS} each`;",
    "const sent = `${resourceName(id)} ×${amount}`;", // 14: a count of a good
    "const top = `calc(${y} + ${gap} + 2px)`;", // 15: CSS
    "const log = `${name}=${value}`;", // 16: a log's field
  ].join("\n");
  assert.deepEqual(
    scanSource(source, "/repo/apps/game/src/ui/features/probe/probe.tsx", rules).map(
      ({ category, line }) => `${line} ${category}`,
    ),
    [
      "1 voice: A number, never a formula",
      "2 number.formula",
      "4 voice: A number, never a formula",
      "5 voice: A number, never a formula",
      "6 number.formula",
    ],
  );
});

test("finds a line past seven words where a player reads it, and lets tips, logs, errors and documents say more", () => {
  const source = [
    'const hint = <p className="text-hud-muted">Steps out on the bright tile beside the realm.</p>;', // 1
    "const line = `Raise an army at ${realm}: it explores for ${points} a tile.`;", // 2
    'step("barracks", "Build barracks: only barracks train troops for your armies.");', // 3: prose handed to a call
    'export const PAUSED = "Payouts paused. Your LORDS stay here until they resume.";', // 4: a words-module phrase
    // 5-12: what stays: a short line, a tooltip, a phrase named for one, a log, an error, a code name, a document, CSS
    "const short = <p>Needs 300 wheat, have 120</p>;",
    'const tip = <span data-tip="How XP is earned: explore a tile, visit a shrine or clear a camp" />;',
    "export const xpTowardTip = (xp: string) => `XP ${xp} buys an uncommon attribute tier for this army`;",
    'console.warn("Previous global chunk switch failed before the hydrated refresh ran");',
    'throw new Error("The shard answered with a release this client cannot decode at all");',
    'const env = "VITE_PUBLIC_L2_RPC_URL is required: the team URL for this chain, from the env";',
    'const order = "Settlement:\\n2 farm\\nCity:\\n4 farm\\n1 wood\\n1 coal\\n1 copper\\n2 wood";',
    "const shadow = { title: `0 2px 0 ${ink}, 0 0 24px ${ink}, 0 0 4px ${ink}` };",
  ].join("\n");
  const scanAs = (fileName) =>
    scanSource(source, fileName, { ...context, wordsModule: fileName.endsWith("/words.ts") })
      .filter(({ category }) => category === "words.long")
      .map(({ line }) => line);
  assert.deepEqual(scanAs("/repo/apps/game/src/ui/features/probe/probe.tsx"), [1, 2, 3, 4]);
  // The legal pages and the patch notes are read as pages.
  assert.deepEqual(scanAs("/repo/apps/game/src/shell/legal.tsx"), []);
});
