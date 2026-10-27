import { useHudMode } from "@/hooks/use-hud-mode";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudPanel, HudTier, HudTabs } from "@/ui/design-system/kit/hud-elements";
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
  type Counts,
  type StudyRow,
} from "./balance-options";

/** The approved next-season rules, planned without sending a game command. */
export function ResearchBalanceLab() {
  useHudMode("frontier");
  const [params, setParams] = useSearchParams();
  const part = params.get("part") ?? "storage";
  return (
    <main className="min-h-screen bg-kit-ground p-4 text-hud-ink sm:p-8" data-lab="research-balance">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-hud-label uppercase tracking-wide text-hud-muted">Next season · approved rules</p>
          <h1 className="text-hud-display">Make each research pick count</h1>
          <p className="max-w-3xl text-hud-body text-hud-muted">
            Plan independent research levels, storage and labor from beast clears. Try a path below; nothing changes in
            a game.
          </p>
        </header>
        <HudTabs
          tabs={[
            { key: "storage", label: "Storage" },
            { key: "tree", label: "Research paths" },
            { key: "beasts", label: "Beast labor" },
          ]}
          value={part}
          onChange={(value) => setParams({ part: value })}
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
  const [row, setRow] = useState<StudyRow>(0);
  const [level, setLevel] = useState(1);
  return (
    <>
      <h2 className="text-hud-title">S2 · Wheat and labor storage</h2>
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
          <ResearchPlan key={`${row}-${level}`} row={row} level={level} initial={[0, 0]} />
        </div>
        <div className="flex flex-col gap-5">
          <Evidence title="Two Granary buyers; neither needs it yet">
            Krump holds 6,582 wheat and Volcanic 6,035. Their City holds 18,000 without research, or 25,200 with their
            one Granary pick. Ten idle Settlements are full; none of the 28 labor stores is full.
          </Evidence>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-hud-label">
              <caption className="pb-2 text-left text-hud-strong">Base capacity per resource</caption>
              <thead>
                <tr>
                  <th>Realm</th>
                  <th>Troops</th>
                  <th>Wheat / labor</th>
                </tr>
              </thead>
              <tbody>
                {REALMS.map((name, index) => (
                  <tr key={name} className="border-t border-hud-line">
                    <td className="py-2">{name}</td>
                    <td>{number(LIVE_CAPACITY[index]!)}</td>
                    <td>{number(capacity(index, 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-hud-body text-hud-muted">
            Storage research adds +40% per rank. At Kingdom, a full 25,000-troop deployment costs 50,000 wheat: take
            Granary, Rations or deploy less. The 40,000-labor Empire upgrade fits the unresearched Kingdom store.
          </p>
        </div>
      </div>
    </>
  );
}

function TreeStudy() {
  return (
    <>
      <h2 className="text-hud-title">T1 · Separate side levels</h2>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <ResearchPlan row={2} level={1} initial={[1, 0]} />
        <div className="flex flex-col gap-5">
          <p className="text-hud-body">
            Drill starts at I and Rations at 0. Each side has its own next price; both can reach V. The building’s model
            shows the higher side. Gems run from 0 to Legendary V.
          </p>
          <p className="text-hud-body">
            Two Barracks purchases in any combination open training buildings. Building a War hall, Supply yard, Scouts’
            lodge or Hearth costs 6,000 Essence + 1,500 labor and grants Common training immediately. Choose camps,
            rifts or beasts when building the lodge; its next four selections share the same ladder.
          </p>
          <p className="text-hud-body">
            After construction, Uncommon costs 16,000 Essence + 3,000 labor. Rare costs 48,000 Essence + 9,000 labor,
            Epic 144,000 + 24,000, and Legendary 360,000 + 60,000. Rebuilding keeps the realm’s training and grants no
            extra level.
          </p>
          <p className="text-hud-label text-hud-muted">
            The plan records added costs. The game also checks your balances, storage capacity and standing buildings.
          </p>
        </div>
      </div>
    </>
  );
}

function ResearchPlan({ row, level, initial }: { row: StudyRow; level: number; initial: Counts }) {
  const [counts, setCounts] = useState<Counts>(initial);
  const [side, setSide] = useState(0);
  const [spent, setSpent] = useState({ essence: 0, labor: 0 });
  const item = ROWS[row];
  const sides = item.sides;
  const price = nextPrice(row, counts, side);
  const buy = () => {
    if (!price) return;
    setCounts(side === 0 ? [counts[0] + 1, counts[1]] : [counts[0], counts[1] + 1]);
    setSpent({ essence: spent.essence + price.essence, labor: spent.labor + price.labor });
  };
  return (
    <HudPanel
      title={`${item.name} research`}
      cue={<HudTier tier={Math.max(...counts) as 0 | 1 | 2 | 3 | 4 | 5} />}
      icon={item.icon}
      collapsible={false}
      bodyClassName="flex flex-col gap-4 px-3 pb-3"
    >
      <p className="text-hud-label text-hud-muted">{counts[0] + counts[1]} purchases · four upgrades per side</p>
      <div className="grid gap-2">
        {sides.map((name, index) => {
          const next = nextPrice(row, counts, index);
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
                  {name} · rank {counts[index]!}
                </span>
                <HudTier tier={counts[index]! as 0 | 1 | 2 | 3 | 4 | 5} />
              </span>
              <span className="text-hud-body">
                {effect(row, index, counts[index]!, level)}
                {next && <> → {effect(row, index, counts[index]! + 1, level)}</>}
              </span>
              <span className="text-hud-label text-hud-muted">
                {next ? `${number(next.essence)} Essence + ${number(next.labor)} labor` : "Maximum level"}
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

function BeastStudy() {
  const [depth, setDepth] = useState(0);
  const replay = beastReplay();
  const rules = DEPTHS[depth]!;
  const range = (guards: readonly number[], by: number) => guards.map((guard) => number(guard / by)).join("–");
  return (
    <>
      <h2 className="text-hud-title">B1 · One labor per four initial guards</h2>
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
            <Reward name="Smaller beasts" guards={rules.weak} labor={range(rules.weak, 4)} />
            <Reward name="Stronger beasts" guards={rules.strong} labor={range(rules.strong, 4)} />
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
            The observed baseline paid zero. Recorded camps: {number(CAMP_LABOR)} labor; reveals: {number(REVEAL_LABOR)}
            .
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
