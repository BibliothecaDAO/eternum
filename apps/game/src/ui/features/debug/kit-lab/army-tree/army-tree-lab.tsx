import { useState } from "react";
import { useHudMode } from "@/hooks/use-hud-mode";
import {
  BARRACKS,
  BRANCHES,
  BUILDINGS,
  ECONOMY,
  NUMERALS,
  ROUTES,
  TRAINING,
  economyEffect,
  number,
  priceText,
  ranks,
  steps,
  stillPath,
  trainingEffect,
  type Branch,
  type Building,
  type RouteId,
} from "./options";
import "./army-tree.css";

export function ArmyTreeLab() {
  useHudMode("frontier");
  const [route, setRoute] = useState<RouteId>("display");
  const [branch, setBranch] = useState<Branch>("Economy");
  const params = new URLSearchParams(window.location.search);
  const capture = params.get("capture"),
    choice = params.get("route");
  if (BRANCHES.some((value) => value === capture) && ROUTES.some((value) => value.id === choice))
    return <Capture route={choice as RouteId} branch={capture as Branch} />;
  const selected = ROUTES.find((value) => value.id === route)!;
  return (
    <main data-lab="army-tree" className="army-tree">
      <header>
        <p className="eyebrow">Owner’s pick · training buildings stay</p>
        <h1>Which path to Legendary V?</h1>
        <p>Common I–V is the shipping display route. The extra rank is an alternative for next season.</p>
      </header>
      <nav aria-label="Tier route">
        {ROUTES.map((item) => (
          <button key={item.id} aria-pressed={route === item.id} onClick={() => setRoute(item.id)}>
            {item.title}
          </button>
        ))}
      </nav>
      <section className="tree-intent" aria-label="Selected proposal">
        <h2>{selected.summary}</h2>
        <p>{selected.tradeoff}</p>
      </section>
      <nav aria-label="Research branch">
        {BRANCHES.map((item) => (
          <button key={item} aria-pressed={branch === item} onClick={() => setBranch(item)}>
            {item}
          </button>
        ))}
      </nav>
      <figure className="tree-still">
        <figcaption>
          {branch} · {selected.title} · E = Essence, L = labor
        </figcaption>
        <picture>
          <source media="(max-width: 650px)" srcSet={stillPath(route, branch, "phone")} />
          <img src={stillPath(route, branch)} alt={`${branch}: ${selected.title}`} />
        </picture>
      </figure>
      <section className="tree-note">
        <h2>What this choice settles</h2>
        <p>
          Both keep all four training buildings, independent economy sides, storage research and the two-purchase
          Barracks gate. Building grants the first trained rank; later research improves new armies.
        </p>
        <p>
          The extra step divides the final price and gain, preserving total research spending and final effects. It adds
          a smaller stopping point, a new rank to teach and another purchase per ladder.
        </p>
        <p>
          The earlier skill-point curve and reduced attribute gains are not approved. These stills hold current effects
          at existing ranks and show the extra midpoint. Troop classes T1/T2/T3 remain separate; picking buildings did
          not pick their renaming.
        </p>
        <p>
          Castle discoveries are unlocks, not rarity ranks: Shrine and Well have one purchase each, Ethereal has three
          layers. No empty rarity steps or new depths are added.
        </p>
      </section>
    </main>
  );
}
function Gem({ rank, route }: { rank: number; route: RouteId }) {
  if (route === "insert" && rank === 0) return null;
  return (
    <span
      className="tree-gem"
      data-rank={route === "insert" && rank === 5 ? 4 : rank}
      aria-label={`${ranks(route)[rank]} ${NUMERALS[route === "display" ? rank : rank - 1]}`}
    >
      {NUMERALS[route === "display" ? rank : rank - 1]}
    </span>
  );
}
function Ladder({
  route,
  name,
  building,
  effects,
}: {
  route: RouteId;
  name: string;
  building: Building;
  effects: string[];
}) {
  return (
    <section className="tree-ladder">
      <h2>{name}</h2>
      <div className="tree-rungs" style={{ gridTemplateColumns: `repeat(${ranks(route).length}, minmax(0, 1fr))` }}>
        {ranks(route).map((name, rank) => (
          <div className="tree-rung" key={name}>
            <div>
              <Gem rank={rank} route={route} />
              <strong>{name}</strong>
            </div>
            <b>{effects[rank]}</b>
            <small>{priceText(building, rank, route)}</small>
            {building === "training" && rank === 1 && <small>First rank included</small>}
          </div>
        ))}
      </div>
    </section>
  );
}
function Capture({ route, branch }: { route: RouteId; branch: Branch }) {
  return (
    <article data-tree-capture className="tree-capture">
      <header>
        <p className="eyebrow">
          {route === "display"
            ? "Current effects & prices · shipping I–V display"
            : "Next-season proposal · Exalted is a working name"}
        </p>
        <h1>{branch} research</h1>
        <p>
          {route === "display"
            ? "Five states. Common I → Legendary V."
            : "Six states. Common has no gem → Legendary V."}
        </p>
      </header>
      {branch === "Economy" || branch === "Barracks" ? (
        <Economy route={route} barracks={branch === "Barracks"} />
      ) : branch === "Training" ? (
        <Training route={route} />
      ) : (
        <Castle route={route} />
      )}
      <footer>E = Essence · L = labor · Prices are per step, not cumulative. No gameplay changes in this study.</footer>
    </article>
  );
}
function Economy({ route, barracks }: { route: RouteId; barracks: boolean }) {
  const rows = barracks ? BARRACKS : ECONOMY;
  return (
    <>
      <p className="tree-explain">
        Build the matching building, then research. Each side has its own prices and level; the building’s gem/model
        follows the higher side. Both sides can reach Legendary.
      </p>
      <div className="tree-builds">
        {(barracks ? ["barracks"] : ["farm", "workshop", "hut"]).map((id) => {
          const item = BUILDINGS[id as Building];
          return (
            <span key={id}>
              {item.name}: first build {number(item.build)} L · {item.population} population
            </span>
          );
        })}
      </div>
      {rows.map((row) => (
        <Ladder
          key={row.name}
          route={route}
          name={row.name}
          building={row.building}
          effects={steps(route).map((step) => economyEffect(row.effect, step))}
        />
      ))}
      {barracks ? (
        <section className="tree-callout">
          <h2>Two purchases open training</h2>
          <p>
            Drill once + Rations once: 8k E / 6k L. Two on one side: 20k E / 12k L. Both open War hall, Supply yard,
            Scouts’ lodge and Hearth.
          </p>
          <p>
            First trained start, mixed route: Barracks 400 L + research 8k E / 6k L + training building 3k L ={" "}
            <strong>8k E / 9.4k L</strong>, before other realm spending.
          </p>
          <p>Rations reduces deployment wheat only. Troop production remains Drill’s separate ladder.</p>
        </section>
      ) : (
        <section className="tree-callout">
          <h2>What the percentages mean</h2>
          <p>
            Output applies to each built producer; Tools does not increase the castle’s passive labor. Storage uses the
            current realm’s base capacity, not building count. One-Hut population is shown; multiple Huts are summed
            before rounding.
          </p>
          <p>
            {route === "display"
              ? "Legendary research budgets per side: Farm 47k E / 32k L; Workshop 94k / 64k; Hut 23.5k / 16k."
              : "The extra step splits the final quarter of output into 12.5% + 12.5%, and the final 50% of storage into 25% + 25%. Total research budgets are unchanged."}
          </p>
        </section>
      )}
    </>
  );
}
function Training({ route }: { route: RouteId }) {
  return (
    <>
      <p className="tree-explain">
        Two Barracks purchases → build the matching training building → first trained rank included → research later
        ranks. One of each building per realm; 3k labor and 2 population each.
      </p>
      {TRAINING.map((item, index) => (
        <Ladder
          key={item.name}
          route={route}
          name={`${item.name} · ${item.attribute}`}
          building="training"
          effects={ranks(route).map((_, rank) => trainingEffect(index, rank, route))}
        />
      ))}
      <section className="tree-callout">
        <h2>
          {route === "display" ? "Build for II, then buy III / IV / V" : "Build for I, then buy II / III / IV / V"}
        </h2>
        <p>
          Common is the untrained state, before building. Training affects new armies; deployed armies keep their
          attributes. A standing building is needed for later research. Demolition keeps learned ranks; rebuilding does
          not grant another rank.
        </p>
        <p>
          Scouts: choose Camps, Rifts or Beasts when building and at each later rank. Totals above assume the same kind
          throughout. Its third rank adds 30% of the chosen kind’s base chance; its first adds 10%.
        </p>
        <p>
          {route === "display"
            ? "After the build: 552k E / 93k L in research. Three paid steps, while all five states remain visible."
            : "After the build: still 552k E / 93k L, now four payments. The final 360k E / 60k L is split into 144k / 24k and 216k / 36k. Scouting’s last +40% becomes +20% at each of the last two ranks."}
        </p>
      </section>
    </>
  );
}
function Castle({ route }: { route: RouteId }) {
  return (
    <>
      <p className="tree-explain">
        Unlocks at the castle. No training building or Barracks gate; pay the listed Essence once. These open
        discoveries or layers, not rarity ranks.
      </p>
      <section className="tree-unlocks">
        <div>
          <h2>Shrine</h2>
          <p>2,000 E</p>
          <p>Discover Shrines. Use one for +200 army XP.</p>
          <strong>Locked → Unlocked</strong>
        </div>
        <div>
          <h2>Well</h2>
          <p>6,000 E</p>
          <p>Discover Wells. Use one for up to +60 stamina.</p>
          <strong>Locked → Unlocked</strong>
        </div>
      </section>
      <section className="tree-callout">
        <h2>Ethereal · buy each layer in order</h2>
        <div className="tree-unlocks">
          {[100000, 250000, 500000].map((price, index) => (
            <div key={price}>
              <h3>Layer {index + 1}</h3>
              <p>{number(price)} E</p>
              <small>{index === 0 ? "From the surface" : `Requires Layer ${index}`}</small>
            </div>
          ))}
        </div>
        <p>Total: 850,000 E. Keep three actual layers; no invented Rare/Epic/Legendary unlock slots.</p>
      </section>
      <section className="tree-callout">
        <h2>Storage is the research hurdle</h2>
        <table>
          <thead>
            <tr>
              <th>Realm</th>
              <th>Base labor store</th>
              <th>Reachable with Storeroom</th>
            </tr>
          </thead>
          <tbody>
            {["Settlement", "City", "Kingdom", "Empire"].map((name, index) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{number([6000, 18000, 40000, 80000][index]!)}</td>
                <td>{number([12000, 54000, 120000, 240000][index]!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {route === "display"
            ? "The last training research costs 60k labor. City cannot hold it even with top Storeroom (54k). Kingdom + one Storeroom upgrade holds exactly 60k."
            : "The last training research costs 36k labor. City + two Storeroom upgrades can hold it. This makes Legendary reachable at a smaller realm even though total research spending is unchanged."}
        </p>
        <p>
          Settlement stops after two Storeroom upgrades: its next 16k labor bill exceeds its 12k capacity. Storage
          upgrades must be paid from the old capacity. A larger displayed future capacity does not fund its own
          purchase. Essence is not capped by these stores.
        </p>
      </section>
    </>
  );
}
