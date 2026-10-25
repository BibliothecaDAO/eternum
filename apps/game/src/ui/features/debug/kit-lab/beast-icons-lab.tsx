import { useSearchParams } from "react-router-dom";
import type { CSSProperties } from "react";
import { frontierBeast } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useHudMode } from "@/hooks/use-hud-mode";
import { Icon } from "@/ui/design-system/icon";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { SiteCardView } from "@/ui/features/frontier/sites/site-card-view";
import catalogue from "../../../../../asset-sources/beast-icon-study/catalog.json";
import "./beast-icons-lab.css";

type Kind = keyof typeof catalogue;
const kinds = Object.keys(catalogue) as Kind[];

/** Review only: the real site card and the balance study's reward row, with no change to production artwork. */
export function BeastIconsLab() {
  useHudMode("frontier");
  const [params, setParams] = useSearchParams();
  const selected = params.get("kind");
  const kind = kinds.find((value) => value === selected) ?? "cyclops";
  return (
    <main className="beast-icons-lab" data-beast-study={kind}>
      <header>
        <h1>Frontier guard icons</h1>
        <p>
          Compare today's icons with two paintings for each creature. Production artwork stays unchanged until chosen.
        </p>
      </header>
      <nav aria-label="Guard to compare">
        {kinds.map((value) => (
          <button
            key={value}
            data-beast-kind={value}
            aria-pressed={kind === value}
            onClick={() => setParams({ kind: value })}
          >
            {catalogue[value].label}
          </button>
        ))}
      </nav>
      <div className="beast-icons-columns">
        {[null, ...catalogue[kind].options].map((candidate) => (
          <Comparison key={`${kind}-${candidate}`} kind={kind} candidate={candidate} />
        ))}
      </div>
      <p>
        Reward figures repeat the balance study's surface example; they do not change game rules. The map cards use the
        game's component.
      </p>
    </main>
  );
}

function Comparison({ kind, candidate }: { kind: Kind; candidate: string | null }) {
  const beast = frontierBeast(
    0,
    kind === "troll" ? StructureType.Camp : StructureType.Beasts,
    kind === "wraith" ? "stronger" : "lowly",
  );
  const meaning = beastMeaning(beast.beast);
  const guard = kind === "cyclops" ? 300 : kind === "wraith" ? 450 : 1_100;
  const reward = kind === "cyclops" ? "75–87.5" : kind === "wraith" ? "112.5–137.5" : "550–650";
  const range = kind === "cyclops" ? "300–350" : kind === "wraith" ? "450–550" : "1,100–1,300";
  const style = candidate
    ? (Object.fromEntries(
        [64, 128, 256].map((size) => [`--beast-art-${size}`, `url("/lab/beast-icons/${size}/${candidate}.webp")`]),
      ) as CSSProperties)
    : undefined;
  return (
    <article data-beast-option={candidate ?? "current"} data-candidate={candidate ?? undefined} style={style}>
      <h2>{candidate ? (candidate.endsWith("-a") ? "A · Portrait" : "B · Creature and gesture") : "Today"}</h2>
      <div className="beast-icons-portrait">
        <Icon name={meaning} size={128} alt={beast.name} />
      </div>
      <div className="beast-icons-sizes">
        {[16, 24, 36, 64].map((size) => (
          <figure key={size}>
            <Icon name={meaning} size={size} />
            <figcaption>{size} px</figcaption>
          </figure>
        ))}
      </div>
      <h3>Balance list</h3>
      <HudPanel
        title="Clear reward"
        icon={candidate ? meaning : "beasts"}
        collapsible={false}
        bodyClassName="px-3 pb-3"
      >
        <div className="flex items-center gap-3 border-b border-hud-line pb-3">
          <Icon name={candidate ? meaning : kind === "troll" ? "camp" : "beasts"} size={36} />
          <div className="flex-1">
            <div className="text-hud-strong">{kind === "troll" ? "Camp / Trolls" : catalogue[kind].label}</div>
            <div className="text-hud-label text-hud-muted">{range} guards</div>
            <div className="text-hud-body text-hud-good">{reward} labor</div>
          </div>
        </div>
      </HudPanel>
      <h3>Map card · fight preview</h3>
      <SiteCardView
        site={kind === "troll" ? "Camp" : "Beasts"}
        beast={{ ...beast, combatClass: "Knight" }}
        army={{ art: "knight-t1", troops: 1_500 }}
        guard={guard}
        fight={{
          outcome: "wins",
          exchanges: 1,
          troopsLost: 50,
          guardLeft: 0,
          whole: { troopsLost: 50, guardKilled: guard, stamina: 30 },
        }}
        pay={kind === "troll" ? { icon: "labor", amount: 550 } : null}
        xp={30}
        verb={null}
        onClose={() => {}}
      />
    </article>
  );
}
