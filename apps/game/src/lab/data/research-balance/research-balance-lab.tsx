import { useHudMode } from "@/hooks/use-hud-mode";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudPanel, HudRarity, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { MID_REALM } from "@/ui/features/frontier/research/progression-fixture";
import { ResearchPanel } from "@/ui/features/frontier/research/research-panel";
import { readResearchTree } from "@/ui/features/frontier/research/research-tree";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  beastReplay,
  CAMP_LABOR,
  capacity,
  DEPTHS,
  effect,
  LIVE_CAPACITY,
  nextPrice,
  number,
  REALMS,
  REVEAL_LABOR,
  ROWS,
  STORAGE_OPTIONS,
  TREE_OPTIONS,
  type Counts,
  type StorageRule,
  type StudyRow,
  type TreeRule,
} from "./balance-options";

/** Proposal fixtures only: choosing and planning never sends a game command. */
export function ResearchBalanceLab() {
  useHudMode("frontier");
  const [params, setParams] = useSearchParams();
  const part = params.get("part") ?? "storage";
  return (
    <main className="bg-kit-ground p-4 text-hud-ink sm:p-8" data-lab="research-balance">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-hud-label uppercase tracking-wide text-hud-muted">Next season · proposals for review</p>
          <h1 className="text-hud-display">Make each research pick count</h1>
          <p className="max-w-3xl text-hud-body text-hud-muted">
            Compare capacity, research paths and labor for beast clears. Try a path below; nothing changes in a game.
          </p>
        </header>
        <HudTabs
          tabs={[
            { key: "storage", label: "Storage" },
            { key: "tree", label: "Research paths" },
            { key: "beasts", label: "Beast labor" },
          ]}
          value={part}
          onChange={(value) =>
            setParams((current) => {
              current.set("part", value);
              return current;
            })
          }
        />
        {part === "storage" ? <StorageStudy /> : part === "tree" ? <TreeStudy /> : <BeastStudy />}
        <footer className="border-t border-hud-line pt-3 text-hud-label text-hud-muted">
          Evidence: perf’s completed days 0–1, 28 realms, 824 reveals, 28 beast clears. Realm balances are a snapshot;
          simulated rewards are gross, before storage clipping. No depth has been entered. These are early observations,
          not a forecast.
        </footer>
      </div>
    </main>
  );
}

function StorageStudy() {
  const [rule, setRule] = useState<StorageRule>("cut");
  const [row, setRow] = useState<StudyRow>(0);
  const [level, setLevel] = useState(1);
  return (
    <>
      <Choices label="Storage option" options={STORAGE_OPTIONS} value={rule} onChange={setRule} />
      <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <HudTabs
            tabs={ROWS.slice(0, 2).map((item) => ({ key: String(item.row), label: item.name }))}
            value={String(row)}
            onChange={(value) => setRow(Number(value) as StudyRow)}
          />
          <label className="flex items-center justify-between gap-3 text-hud-body">
            Realm{" "}
            <select
              aria-label="Realm level"
              className="rounded border border-hud-line bg-hud-well p-2"
              value={level}
              onChange={(event) => setLevel(Number(event.target.value))}
            >
              {REALMS.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <ResearchPlan
            key={`${rule}-${row}-${level}`}
            row={row}
            level={level}
            storage={rule}
            tree="independent"
            initial={[0, 0]}
          />
        </div>
        <div className="flex flex-col gap-5">
          <Evidence title="Two Granary buyers; neither needs it yet">
            Krump holds 6,582 wheat and Volcanic 6,035. Their City holds 18,000 without research, or 27,000 with their
            one Granary pick. Ten idle Settlements are full; none of the 28 labor stores is full.
          </Evidence>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-hud-label">
              <caption className="pb-2 text-left text-hud-strong">Base capacity per resource</caption>
              <thead>
                <tr>
                  <th>Realm</th>
                  <th>Today</th>
                  <th>Proposal</th>
                </tr>
              </thead>
              <tbody>
                {REALMS.map((name, index) => (
                  <tr key={name} className="border-t border-hud-line">
                    <td className="py-2">{name}</td>
                    <td>{number(LIVE_CAPACITY[index]!)}</td>
                    <td>{number(capacity(index, 0, rule))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-hud-body text-hud-muted">
            {rule === "cut"
              ? "Removes Granary and Storeroom. A realm upgrade grows wheat, labor and troop capacity together. Research improves output; it no longer competes with the realm’s storage upgrade."
              : "Proposal changes wheat and labor capacity only. At Kingdom, a full 25,000-troop deployment costs 50,000 wheat: take Granary, Rations or deploy less. A 40,000-labor Empire upgrade still fits. No live player has reached these levels to prove this choice is needed."}
          </p>
        </div>
      </div>
    </>
  );
}

function TreeStudy() {
  const [rule, setRule] = useState<TreeRule>("independent");
  return (
    <>
      <Choices label="Research path option" options={TREE_OPTIONS} value={rule} onChange={setRule} />
      <div className="grid items-start gap-6 md:grid-cols-2">
        <ResearchPlan key={rule} row={2} level={1} storage="current" tree={rule} initial={[1, 0]} />
        <div className="flex flex-col gap-5">
          <Evidence title="Switching sides already works">
            Volcanic bought Granary, then Fields. Today’s rule locks the unchosen side at each past rung; it does not
            lock all future choices to one side.
          </Evidence>
          <p className="text-hud-body">
            Start with Drill at level 2 and Rations at level 1. Try raising Drill to level 3, or Rations to level 2. A
            side’s level counts its own improvements; Common is level 1.
          </p>
          <p className="text-hud-body text-hud-muted">
            {rule === "independent"
              ? "Both sides can reach level 5. Two Barracks purchases in any combination still open training buildings. Scouts’ lodge keeps four shared training tiers, because armies still have only four Scouting upgrades."
              : rule === "budget"
                ? "Cheaper to open the other side, but four purchases still end this row. This preserves today’s power budget and does not fully satisfy “never locked out”."
                : "The production panel below still says “The side is kept for the season.” The proposed wording is: “Choose either side at the next tier. Past picks stay.” Prices and the four-pick limit stay as they are."}
          </p>
          <p className="text-hud-label text-hud-muted">
            The plan isolates the rule. It records costs, not a funded realm’s affordability; the live panel also checks
            resources, storage and standing buildings.
          </p>
        </div>
      </div>
      {rule === "current" && <CurrentPanel />}
    </>
  );
}

function ResearchPlan({
  row,
  level,
  storage,
  tree,
  initial,
}: {
  row: StudyRow;
  level: number;
  storage: StorageRule | "current";
  tree: TreeRule;
  initial: Counts;
}) {
  const [counts, setCounts] = useState<Counts>(initial);
  const [side, setSide] = useState(0);
  const [spent, setSpent] = useState({ essence: 0, labor: 0 });
  const item = ROWS[row];
  const sides = storage === "cut" && row !== 2 ? item.sides.slice(0, 1) : item.sides;
  const price = nextPrice(row, counts, side, tree);
  const buy = () => {
    if (!price) return;
    setCounts(side === 0 ? [counts[0] + 1, counts[1]] : [counts[0], counts[1] + 1]);
    setSpent({ essence: spent.essence + price.essence, labor: spent.labor + price.labor });
  };
  return (
    <HudPanel
      title={`${item.name} research`}
      icon={item.icon}
      collapsible={false}
      bodyClassName="flex flex-col gap-4 px-3 pb-3"
    >
      <p className="text-hud-label text-hud-muted">
        {tree === "independent"
          ? `${counts[0] + counts[1]} purchases · four upgrades per side`
          : `${counts[0] + counts[1]} / 4 shared purchases`}
      </p>
      <div className="grid gap-2">
        {sides.map((name, index) => {
          const next = nextPrice(row, counts, index, tree);
          return (
            <button
              type="button"
              key={name}
              aria-pressed={side === index}
              onClick={() => setSide(index)}
              className={`flex flex-col gap-2 rounded-md border p-3 text-left ${side === index ? "border-hud-accent bg-hud-chosen" : "border-hud-line bg-hud-well"}`}
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-hud-strong">
                  {name} · level {counts[index]! + 1}
                </span>
                <HudRarity tier={(counts[index]! + 1) as 1 | 2 | 3 | 4 | 5} />
              </span>
              <span className="text-hud-body">
                {effect(row, index, counts[index]!, level, storage)}
                {next && <> → {effect(row, index, counts[index]! + 1, level, storage)}</>}
              </span>
              <span className="text-hud-label text-hud-muted">
                {next
                  ? `${number(next.essence)} Essence + ${number(next.labor)} labor`
                  : counts[index] === 4
                    ? "Maximum level"
                    : "Four-pick limit reached"}
              </span>
            </button>
          );
        })}
      </div>
      <HudButton kind="primary" onClick={buy} disabled={!price}>
        Add {sides[side]} to plan
      </HudButton>
      <p aria-live="polite" data-plan-cost className="text-hud-label">
        Added cost: {number(spent.essence)} Essence · {number(spent.labor)} labor
      </p>
      <HudButton
        kind="quiet"
        size="sm"
        onClick={() => {
          setCounts(initial);
          setSpent({ essence: 0, labor: 0 });
          setSide(0);
        }}
      >
        Reset plan
      </HudButton>
    </HudPanel>
  );
}

function CurrentPanel() {
  const [picked, setPicked] = useState("row-0");
  return (
    <section className="flex max-w-lg flex-col gap-2">
      <h2 className="text-hud-title">Today’s full panel · example City</h2>
      <ResearchPanel
        nodes={readResearchTree(MID_REALM)}
        essence={MID_REALM.essence}
        labor={MID_REALM.labor}
        picked={picked}
        onPick={setPicked}
        sending={new Set()}
        fixFor={() => undefined}
        onResearch={() => undefined}
      />
    </section>
  );
}

function BeastStudy() {
  const [divisor, setDivisor] = useState(4);
  const [depth, setDepth] = useState(0);
  const replay = beastReplay(divisor);
  const rules = DEPTHS[depth]!;
  const range = (guards: readonly number[], by: number) => guards.map((guard) => number(guard / by)).join("–");
  return (
    <>
      <Choices
        label="Beast payout"
        options={[
          {
            key: "4",
            label: "B1 · One labor / 4 guards",
            detail:
              "Recommended · A small clear buys meaningful progress; camps still pay more per clear and usually per attack.",
          },
          {
            key: "8",
            label: "B2 · One labor / 8 guards",
            detail: "Conservative · A typical clear pays about one day-1 median reveal’s labor.",
          },
          {
            key: "2",
            label: "B3 · One labor / 2 guards",
            detail:
              "Generous · Same rate as camps, on smaller guards. The 28 observed beast clears would pay more than all seven camps combined.",
          },
        ]}
        value={String(divisor)}
        onChange={(value) => setDivisor(Number(value))}
      />
      <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 text-hud-body">
            Depth{" "}
            <select
              aria-label="Depth"
              value={depth}
              onChange={(event) => setDepth(Number(event.target.value))}
              className="rounded border border-hud-line bg-hud-well p-2"
            >
              {DEPTHS.map((item, index) => (
                <option key={item.name} value={index}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <HudPanel
            title="Clear reward"
            icon="beasts"
            collapsible={false}
            bodyClassName="flex flex-col gap-4 px-3 pb-3"
          >
            <Reward name="Smaller beasts" guards={rules.weak} labor={range(rules.weak, divisor)} />
            <Reward name="Stronger beasts" guards={rules.strong} labor={range(rules.strong, divisor)} />
            <Reward name="Camp / Trolls" guards={rules.camp} labor={range(rules.camp, 2)} />
            <p className="text-hud-label text-hud-muted">
              XP stays. Labor pays once on the clear, based on the starting guard. No extra depth multiplier; deeper
              beasts already have more guards.
            </p>
          </HudPanel>
        </div>
        <div className="flex flex-col gap-5">
          <Evidence title="Replay of 28 beast clears">
            {number(replay.total)} extra labor for 11 players over days 0–1. Median {number(replay.median)} per clear.
            Today: zero. Recorded camps: {number(CAMP_LABOR)} labor; reveals: {number(REVEAL_LABOR)}.
          </Evidence>
          <dl className="grid grid-cols-2 gap-3 text-hud-body">
            <dt>Beasts / camp income</dt>
            <dd>{number((replay.total / CAMP_LABOR) * 100)}%</dd>
            <dt>Added to reveals + camps</dt>
            <dd>{number((replay.total / (REVEAL_LABOR + CAMP_LABOR)) * 100)}%</dd>
            <dt>Castle passive labor</dt>
            <dd>100.8 / hour</dd>
            <dt>One unresearched Workshop</dt>
            <dd>201.6 / hour</dd>
          </dl>
          <Evidence title="The larger labor imbalance">
            One account claimed 23,193 stored labor from 24 NFT grants on day 1. That exceeds all 28 realms’ recorded
            reveal and camp labor that day (13,112). Beast pay will help clears; it cannot settle that advantage.
          </Evidence>
        </div>
      </div>
    </>
  );
}

function Reward({ name, guards, labor }: { name: string; guards: readonly number[]; labor: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-hud-line pb-3">
      <Icon name={name === "Camp / Trolls" ? "camp" : "beasts"} size={36} />
      <div className="flex-1">
        <div className="text-hud-strong">{name}</div>
        <div className="text-hud-label text-hud-muted">{guards.map(number).join("–")} guards</div>
        <div className="text-hud-body text-hud-good">{labor} labor</div>
      </div>
    </div>
  );
}

function Evidence({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="border-l-2 border-hud-accent pl-4">
      <h2 className="mb-2 text-hud-strong">{title}</h2>
      <p className="text-hud-body text-hud-muted">{children}</p>
    </aside>
  );
}

function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { key: T; label: string; detail: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <HudButton
            key={option.key}
            kind="secondary"
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
          >
            {option.label}
          </HudButton>
        ))}
      </div>
      <p className="max-w-3xl text-hud-body text-hud-muted">{options.find((option) => option.key === value)!.detail}</p>
    </div>
  );
}
