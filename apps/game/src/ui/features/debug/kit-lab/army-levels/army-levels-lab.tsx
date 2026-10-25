import { useState } from "react";
import { useHudMode } from "@/hooks/use-hud-mode";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import {
  ATTRIBUTES,
  effect,
  gain,
  levelProgress,
  OPTIONS,
  PRICES,
  training,
  type Counts,
  type LevelOption,
  type ScoutKind,
} from "./level-options";
import observations from "./observations.json";

/** Compare local plans only; this page never sends a command or changes a game's rules. */
export function ArmyLevelsLab() {
  useHudMode("frontier");
  const [xp, setXp] = useState(300);
  const [trained, setTrained] = useState("none");
  return (
    <main data-lab="army-levels" className="min-h-screen bg-kit-ground p-4 text-hud-ink sm:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-2">
          <p className="text-hud-label text-hud-muted">Next season · balance proposals</p>
          <h1 className="text-hud-display">One level, one choice</h1>
          <p className="text-hud-body">
            Spend a point on any uncapped attribute. Compare with today's XP prices; this changes no game.
          </p>
        </header>
        <p className="text-hud-body text-hud-muted">
          Recommended: one point always buys one rank. Its gain falls with ranks already held, including training: 100%,
          80%, 60%, then 40% of the first gain. Both proposals need 50, 100, 150… XP per level.
        </p>
        <div className="flex flex-wrap gap-4 text-hud-body">
          <label>
            XP earned this expedition{" "}
            <input
              aria-label="XP earned"
              type="number"
              min={0}
              max={6800}
              step={1}
              value={xp}
              onChange={(event) => setXp(Math.max(0, Math.min(6800, Math.floor(Number(event.target.value)))))}
              className="ml-2 w-24 rounded border border-hud-line bg-hud-well p-2"
            />
          </label>
          <label>
            Starts trained{" "}
            <select
              aria-label="Starts trained"
              value={trained}
              onChange={(event) => setTrained(event.target.value)}
              className="ml-2 rounded border border-hud-line bg-hud-well p-2"
            >
              <option value="none">None</option>
              <option value="battle-1">Battle +1</option>
              <option value="battle-2">Battle +2</option>
              <option value="scouting-2">Scouting +2 on Beasts</option>
              <option value="battle-4">Battle +4 (capped)</option>
              <option value="all">All +4 (capped)</option>
            </select>
          </label>
        </div>
        <p className="text-hud-label text-hud-muted">Changing XP or training starts a fresh comparison.</p>
        <Comparison key={`${xp}-${trained}`} xp={xp} trained={training(trained)} />
        <section className="flex flex-col gap-3 border-t border-hud-line pt-4">
          <h2 className="text-hud-title">What the observed armies could reach</h2>
          <p className="text-hud-body text-hud-muted">
            381 armies, 32 realms, one pull on 25 October at 17:24 UTC. First-choice eligibility from the same earned
            XP; no changed actions.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-hud-label">
              <thead>
                <tr>
                  <th>Day / armies</th>
                  <th>XP median / p90 / max</th>
                  <th>Today</th>
                  <th>Both proposals</th>
                </tr>
              </thead>
              <tbody>
                {observations.map((day) => (
                  <tr key={day.day} className="border-t border-hud-line">
                    <td className="py-2">
                      {day.day}
                      {day.day === 7 ? "*" : ""} / {day.n}
                    </td>
                    <td>
                      {day.xp_median} / {day.xp_p90} / {day.xp_max}
                    </td>
                    <td>
                      {day.today_eligible} / {day.n}
                    </td>
                    <td>
                      {day.flat_eligible} / {day.n}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-hud-label text-hud-muted">
            *Day 7 is partial. Groups are by muster day, not full-day earning rates. Historical Shrine XP is a lower
            bound. No depth play is represented. Median armies still earn no point in either proposal.
          </p>
        </section>
        <p className="text-hud-body text-hud-muted">
          Training occupies its attribute slots without spending earned points or raising XP prices. Four slots per
          attribute. Merging keeps only the chosen target's level, points and training. Unspent points do not expire
          before the army does.
        </p>
      </div>
    </main>
  );
}

function Comparison({ xp, trained }: { xp: number; trained: Counts }) {
  const [attribute, setAttribute] = useState(0);
  const [kind, setKind] = useState<ScoutKind>("Beasts");
  return (
    <>
      <div className="flex flex-wrap gap-4 text-hud-body">
        <label>
          Build toward{" "}
          <select
            aria-label="Build toward"
            value={attribute}
            onChange={(event) => setAttribute(Number(event.target.value))}
            className="ml-2 rounded border border-hud-line bg-hud-well p-2"
          >
            {ATTRIBUTES.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {attribute === 2 && (
          <label>
            Find more{" "}
            <select
              aria-label="Find more"
              value={kind}
              onChange={(event) => setKind(event.target.value as ScoutKind)}
              className="ml-2 rounded border border-hud-line bg-hud-well p-2"
            >
              {["Beasts", "Camps", "Rifts"].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Plan xp={xp} trained={trained} option="today" attribute={attribute} kind={kind} />
        <Plan xp={xp} trained={trained} option="flat" attribute={attribute} kind={kind} />
        <Plan xp={xp} trained={trained} option="diminishing" attribute={attribute} kind={kind} />
      </div>
    </>
  );
}

function Plan({
  xp,
  trained,
  option,
  attribute,
  kind,
}: {
  xp: number;
  trained: Counts;
  option: LevelOption | "today";
  attribute: number;
  kind: ScoutKind;
}) {
  const [counts, setCounts] = useState<Counts>([...trained]);
  const [spentXp, setSpentXp] = useState(0);
  const [kinds, setKinds] = useState<ScoutKind[]>(Array.from({ length: trained[2] }, () => "Beasts"));
  const today = option === "today";
  const progress = levelProgress(xp, trained);
  const allocated = counts.reduce((sum, count, index) => sum + count - trained[index]!, 0);
  const available = progress.points - allocated;
  const price = PRICES[counts[attribute]!];
  const capped = price === undefined;
  const canBuy = !capped && (today ? xp - spentXp >= price : available > 0);
  const spend = () => {
    if (!canBuy) return;
    setCounts((before) => before.map((count, index) => count + (index === attribute ? 1 : 0)) as Counts);
    if (today) setSpentXp(spentXp + price);
    if (attribute === 2) setKinds([...kinds, kind]);
  };
  return (
    <section
      aria-label={today ? "Today" : option === "flat" ? "Previous proposal" : "Proposal"}
      data-plan={option}
      className="scroll-mt-20"
    >
      <HudPanel
        title={today ? "Today · buy each tier" : `${OPTIONS[option].label} · level ${progress.level}`}
        collapsible={false}
        bodyClassName="p-4"
      >
        <div className="flex flex-col gap-4">
          {today ? (
            <p className="text-hud-title">{xp - spentXp} XP unspent</p>
          ) : (
            <div className="flex items-center gap-3">
              <XpRing into={progress.into} next={progress.next} capped={progress.capped} />
              <div>
                <p className="text-hud-title" data-points>
                  {available} {available === 1 ? "point" : "points"} available
                </p>
                <p className="text-hud-label text-hud-muted" data-progress>
                  {progress.capped
                    ? "All remaining points earned"
                    : `${progress.into} / ${progress.next} XP to level ${progress.level + 1}`}
                </p>
              </div>
            </div>
          )}
          <dl className="flex flex-col gap-3">
            {ATTRIBUTES.map((name, index) => (
              <div key={name} className="border-b border-hud-line pb-2">
                <dt className="text-hud-strong">
                  {name} · {counts[index]} / 4
                </dt>
                <dd className="text-hud-body">{effect(index, counts[index]!, option, kinds)}</dd>
              </div>
            ))}
          </dl>
          <p className="min-h-10 text-hud-body" data-next>
            {capped
              ? `${ATTRIBUTES[attribute]} is capped. Choose another attribute.`
              : `Next gain: ${gain(attribute, counts[attribute]!, option)} · ${today ? `${price} XP` : "1 point"}`}
          </p>
          <HudButton kind={option === "diminishing" ? "primary" : "secondary"} disabled={!canBuy} onClick={spend}>
            {today ? "Upgrade today" : option === "flat" ? "Spend flat point" : "Spend point"}
          </HudButton>
          <p className="text-hud-label text-hud-muted">
            Each purchase refills up to 30 stamina, after any Logistics increase. Training grants no refill. This
            comparison shows bonuses; it does not simulate stamina use.
          </p>
        </div>
      </HudPanel>
    </section>
  );
}

function XpRing({ into, next, capped }: { into: number; next: number; capped: boolean }) {
  const share = capped ? 1 : into / next;
  return (
    <div
      className="relative size-16 shrink-0"
      role="img"
      aria-label={capped ? "XP complete" : `${into} of ${next} XP to next level`}
    >
      <Icon name="troops" size={44} className="absolute left-[10px] top-[10px] rounded-full" />
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="3" className="text-hud-line" />
        <circle
          cx="32"
          cy="32"
          r="29"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          pathLength="100"
          strokeDasharray={`${share * 100} 100`}
          className="text-hud-gold"
        />
      </svg>
    </div>
  );
}
