import { useState } from "react";
import { useHudMode } from "@/hooks/use-hud-mode";
import { HudTierChip } from "@/ui/design-system/kit/hud-elements";
import {
  ATTRIBUTES,
  bonus,
  earnedPoints,
  effect,
  gain,
  NUMERALS,
  OPTIONS,
  RANKS,
  SCENES,
  stillPath,
  type OptionId,
  type Scene,
} from "./options";
import "./army-tree.css";

export function ArmyTreeLab() {
  useHudMode("frontier");
  const [option, setOption] = useState<(typeof OPTIONS)[number]>(OPTIONS[0]);
  const [scene, setScene] = useState<Scene>("Research");
  const params = new URLSearchParams(window.location.search);
  const capture = params.get("capture");
  const choice = params.get("option");
  if (SCENES.some((value) => value === capture) && ["today", "a", "b", "c"].includes(choice ?? ""))
    return <Capture option={choice as OptionId} scene={capture as Scene} />;
  return (
    <main data-lab="army-tree" className="army-tree">
      <header>
        <p className="eyebrow">Next season · choose a whole army tree</p>
        <h1>How does an army grow?</h1>
        <p>Three proposals beside the T1/B1 baseline. These are still images; no game rules change here.</p>
        <p className="tree-note">
          Observed in Frontier: 185 army upgrades by nine players; four training-research purchases by three. Low use
          can reflect access and price, not lack of value.
        </p>
      </header>
      <nav aria-label="Tree option">
        {OPTIONS.map((item) => (
          <button key={item.id} aria-pressed={item.id === option.id} onClick={() => setOption(item)}>
            {item.title}
            {item.id === "a" ? " · recommended" : ""}
          </button>
        ))}
      </nav>
      <section className="tree-intent" aria-label="Selected proposal">
        <h2>{option.summary}</h2>
        <p>{option.path}</p>
        <p>{option.troops}</p>
      </section>
      <nav aria-label="Moment">
        {SCENES.map((item) => (
          <button key={item} aria-pressed={item === scene} onClick={() => setScene(item)}>
            {item}
          </button>
        ))}
      </nav>
      <div className="tree-comparison">
        <figure>
          <figcaption>
            {scene === "Troops" ? "Current troop chips · Blitz examples" : "T1/B1 rules · original gem draft I–V"}
          </figcaption>
          <img src={stillPath("today", scene)} alt={`Current rules: ${scene}`} />
        </figure>
        <figure>
          <figcaption>{option.title}</figcaption>
          <img src={stillPath(option.id, scene)} alt={`${option.title}: ${scene}`} />
        </figure>
      </div>
      <section className="tree-cost" aria-label="What changes">
        <p>
          <strong>Deletes:</strong> {option.removes}
        </p>
        <p>
          <strong>Tradeoff:</strong> {option.tradeoff}
        </p>
      </section>
      <section className="tree-numbering" aria-label="One rank language">
        <h2>Common has no gem. I is the first upgrade.</h2>
        <div>
          {RANKS.map((rank, index) => (
            <span key={rank}>
              <Gem rank={index} /> {rank}
            </span>
          ))}
        </div>
        <p>
          The same rule applies to army attributes, research, buildings and chests. Models retain their five visual
          stages. The XP ring says “next point”; it does not add another level number.
        </p>
        <p className="tree-note">
          Proposed gains count trained ranks: Battle I adds 10%, II adds 8%, III adds 6%, IV adds 4%. Every point still
          buys one uncapped rank. All three proposals use the same 50 / 100 / 150… XP curve.
        </p>
        <p className="tree-note">
          Blitz deployments: T1 185 · T2 5 · T3 81. This sample does not establish why T2 was rare or justify removing
          it. The troop naming choice can accompany any tree; C demonstrates the folded alternative.
        </p>
      </section>
    </main>
  );
}

function Gem({ rank, today = false }: { rank: number; today?: boolean }) {
  if (!today && rank === 0) return null;
  return (
    <span className="tree-gem" data-rank={rank} aria-label={`${RANKS[rank]} ${NUMERALS[today ? rank : rank - 1]}`}>
      {NUMERALS[today ? rank : rank - 1]}
    </span>
  );
}

function TroopMark({ option, tier }: { option: OptionId; tier: 1 | 2 | 3 }) {
  if (option === "today") return <HudTierChip tier={tier} />;
  if (option === "c") return <Gem rank={tier - 1} />;
  return <span className="tree-troop-chip">T{tier}</span>;
}

function TroopName({ option, tier }: { option: OptionId; tier: 1 | 2 | 3 }) {
  return (
    <span className="tree-troop-name">
      {option === "c" ? `${RANKS[tier - 1]} Knights` : "Knights"} <TroopMark option={option} tier={tier} />
    </span>
  );
}

function Troops({ option }: { option: OptionId }) {
  return (
    <>
      <p className="tree-explain">Blitz examples · troop class is separate from an army’s Battle rank.</p>
      <section className="tree-troop-surface">
        <h2>Map tokens</h2>
        <div className="tree-tokens">
          {([1, 2, 3] as const).map((tier) => (
            <div key={tier}>
              <span>Army {tier}</span>
              <TroopName option={option} tier={tier} />
            </div>
          ))}
        </div>
      </section>
      <section className="tree-troop-surface">
        <h2>Army plate</h2>
        <div className="tree-plate">
          <strong>Army 2 · 1,000</strong>
          <TroopName option={option} tier={2} />
        </div>
        <div className="tree-plate">
          <span>Battle</span>
          <Gem rank={2} today={option === "today"} />
        </div>
        <p className="tree-explain">Battle upgrades change damage, never the troop class.</p>
      </section>
      <section className="tree-troop-surface">
        <h2>Transfer troops</h2>
        <p className="tree-explain">
          Source: <TroopName option={option} tier={2} />
        </p>
        {([1, 2, 3] as const).map((tier) => (
          <div className="tree-transfer-row" key={tier}>
            <TroopName option={option} tier={tier} />
            <span>{tier === 2 ? "Can reinforce" : "Different troop class"}</span>
          </div>
        ))}
        <p className="tree-explain">Occupied targets need the same troop type and class. Empty targets accept any.</p>
      </section>
      <p className="tree-explain">
        {option === "c"
          ? "Common: no gem. Uncommon I is green; Rare II is blue. Troop classes stop at Rare; attribute ranks continue to Legendary."
          : option === "today"
            ? "Troop colors today: T1 blue · T2 green · T3 purple. These colors do not follow the rarity order."
            : "A rectangular T chip identifies troop class. Colored numeral gems identify attribute, research and rarity upgrades."}
      </p>
    </>
  );
}

function Capture({ option, scene }: { option: OptionId; scene: Scene }) {
  if (scene === "Troops")
    return (
      <article data-tree-capture className="tree-capture">
        <header>
          <p className="eyebrow">One troop identity · three surfaces</p>
          <h1>Troops and upgrades</h1>
        </header>
        <Troops option={option} />
        <footer>Names change here; production, strength and transfer rules stay the same.</footer>
      </article>
    );
  const today = option === "today";
  const noTraining = option === "b";
  const ranks = today ? [2, 1, 0, 0] : noTraining ? [1, 1, 0, 0] : [2, 1, 1, 0];
  const points = earnedPoints(300, noTraining ? 0 : 2) - 2;
  const title =
    scene === "Research"
      ? "Castle research"
      : scene === "Army"
        ? "Army 7"
        : today
          ? "Choose an upgrade"
          : "One point earned";
  return (
    <article data-tree-capture className="tree-capture">
      <header>
        <p className="eyebrow">{scene === "Research" ? "Volcanic · army branch" : "Volcanic · this expedition"}</p>
        <h1>{title}</h1>
      </header>
      {scene === "Research" ? (
        <Research option={option} />
      ) : (
        <>
          <div className="tree-strip">
            <span>
              1,000 <TroopName option={option} tier={1} />
            </span>
            <span>80 / 120 stamina</span>
          </div>
          <div className="tree-xp">
            <strong>{today ? "200 XP unspent" : `${points} point available`}</strong>
            <span>300 XP earned this expedition</span>
            <div className="tree-track">
              <i style={{ width: today ? "100%" : "0%" }} />
            </div>
            <small>
              {today
                ? "Battle needs 400 XP · other upgrades start at 100"
                : "0 / 200 XP to next point · spending keeps this progress"}
            </small>
          </div>
          <div className="tree-attributes">
            {ATTRIBUTES.map((attribute, index) => {
              const rank = ranks[index]!;
              const next = scene === "Level up";
              return (
                <section key={attribute} className={next && index === 0 ? "tree-attribute chosen" : "tree-attribute"}>
                  <div>
                    <h2>{attribute}</h2>
                    <Gem rank={rank + (next ? 1 : 0)} today={today} />
                  </div>
                  <strong>
                    {next ? effect(index, gain(index, rank, today)) : effect(index, bonus(index, rank, today))}
                  </strong>
                  <small>
                    {next
                      ? today
                        ? `${[100, 200, 400, 800][rank]} XP${index === 0 ? " · need 200 more" : ""}`
                        : "1 point"
                      : rank === 0
                        ? "Common · no rank yet"
                        : !noTraining && index === 0
                          ? "Starts trained · castle research"
                          : "Earned this expedition"}
                  </small>
                </section>
              );
            })}
          </div>
          <p className="tree-explain">
            {today
              ? "Research raises new armies’ starting tiers. XP buys each later tier at its own price."
              : noTraining
                ? "Every army starts Common. Points shape this army only; new armies start fresh."
                : "Training is part of the rank: a third Battle rank adds 6%, while the first adds 10%."}
          </p>
          <div className={`tree-action ${today && scene === "Level up" ? "unavailable" : ""}`}>
            {scene === "Army"
              ? today
                ? "Level up"
                : "Spend point"
              : today
                ? "Battle IV · need 200 more XP"
                : `Spend 1 point → Battle ${noTraining ? "II" : "III"}`}
          </div>
          {scene === "Level up" && !today && (
            <p className="tree-after">After: {effect(0, bonus(0, ranks[0]! + 1))}. Up to 30 stamina restored.</p>
          )}
        </>
      )}
      <footer>
        {today ? "Current tier numbers: Common I → Legendary V" : "Common: no gem · Uncommon I → Legendary IV"}
      </footer>
    </article>
  );
}

function Research({ option }: { option: OptionId }) {
  const today = option === "today";
  if (option === "b")
    return (
      <>
        <div className="tree-strip">
          <span>Economy</span>
          <span>Castle</span>
        </div>
        <div className="tree-attributes">
          {["Fields", "Tools", "Drill", "Rations"].map((name) => (
            <section className="tree-attribute" key={name}>
              <div>
                <h2>{name}</h2>
                <Gem rank={1} />
              </div>
              <small>Realm research</small>
            </section>
          ))}
        </div>
        <section className="tree-detail">
          <p className="eyebrow">Army training removed</p>
          <h2>Learn on expeditions</h2>
          <p>Deploy at Common. Explore, clear sites and use Shrines to earn XP.</p>
          <p>50 XP earns the first point. Spend it on Battle, Logistics, Scouting or Homecoming.</p>
        </section>
        <div className="tree-action">Open army</div>
        <p className="tree-explain">No training buildings, training prices or Barracks research gate.</p>
      </>
    );
  return (
    <>
      <div className="tree-strip">
        <span>✓ Two Barracks upgrades</span>
        <span>Training open</span>
      </div>
      <div className="tree-attributes">
        {ATTRIBUTES.map((attribute, index) => (
          <section key={attribute} className={`tree-attribute ${index === 0 ? "chosen" : ""}`}>
            <div>
              <h2>{attribute}</h2>
              <Gem rank={index === 0 ? 2 : 0} today={today} />
            </div>
            <small>
              {index === 0
                ? "New armies start here"
                : option === "a"
                  ? "3,000 labor → first rank"
                  : `Build ${["War hall", "Supply yard", "Scouts’ lodge", "Hearth"][index]}`}
            </small>
          </section>
        ))}
      </div>
      <section className="tree-detail">
        <div>
          <h2>Battle training</h2>
          <Gem rank={3} today={today} />
        </div>
        <p>
          New armies: {effect(0, bonus(0, 2, today))} → <strong>{effect(0, bonus(0, 3, today))}</strong>
        </p>
        <p>Existing armies keep their ranks.</p>
        <dl>
          <div>
            <dt>Essence</dt>
            <dd>144,000</dd>
          </div>
          <div>
            <dt>Labor</dt>
            <dd>24,000</dd>
          </div>
        </dl>
      </section>
      <div className="tree-action">Research Battle {today ? "IV" : "III"}</div>
      <p className="tree-explain">
        {option === "a"
          ? "First rank: 3,000 labor at the castle. No training building or population cost. Scouts choose a kind when researching."
          : "War hall built: first rank included for 3,000 labor and 2 population. Each attribute needs its own building. Scouts choose a kind when building."}
      </p>
    </>
  );
}
