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
    "const held = formatAmount(knownBalance(raw));", // 28: floored, so 0.5 reads 0, never <1
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
    "42 number.plural",
    "43 number.percent",
    "44 number.plural",
    "45 number.plural",
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
    "const max = knownBalance(raw) ?? 0;",
    'import { formatAmount } from "@bibliothecadao/types";',
    "const troops = formatExact(divideByPrecision(raw));",
    "const exact = formatAmount(divideByPrecision(raw, false));",
    'import { AmountSlider } from "@/ui/design-system/kit/amount-slider";',
    "const byName = { [ResourcesIds[id]]: 1 };",
    "export function GoldRow({ n }) { return <span>{n}</span>; }",
    "if (troop === 'Knight') {}",
    "const top = <p>#{rank} · {formatPoints(points)}</p>;",
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
