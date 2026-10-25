import { frontierBeast } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useHudMode } from "@/hooks/use-hud-mode";
import { Icon } from "@/ui/design-system/icon";
import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { SiteCardView } from "@/ui/features/frontier/sites/site-card-view";
import "./beast-icons-lab.css";

const encounters = [
  { label: "Smaller beasts", category: StructureType.Beasts, band: "lowly", guard: 300 },
  { label: "Stronger beasts", category: StructureType.Beasts, band: "stronger", guard: 450 },
  { label: "Camps", category: StructureType.Camp, band: "lowly", guard: 1100 },
] as const;

/** Selected production paintings, in the guard card and the balance row; Blitz retains its site artwork. */
export function BeastIconsLab() {
  useHudMode("frontier");
  return (
    <main className="beast-icons-lab" data-beast-study="selected">
      <header>
        <h1>Frontier guard icons</h1>
        <p>The selected paintings, delivered through the game's icon catalogue.</p>
      </header>
      <div className="beast-icons-columns">
        {encounters.map(({ label, category, band, guard }) => {
          const beast = frontierBeast(0, category, band);
          const meaning = structureMeaning(category, "frontier", beast.beast);
          return (
            <article key={beast.beast} data-beast-option={beast.beast}>
              <h2>
                {label} · {beast.name}
              </h2>
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
              <HudPanel title="Clear reward" icon="labor" collapsible={false} bodyClassName="px-3 pb-3">
                <div className="flex items-center gap-3 border-b border-hud-line pb-3">
                  <Icon name={meaning} size={36} />
                  <span className="text-hud-strong">{label}</span>
                </div>
              </HudPanel>
              <h3>Map card · fight preview</h3>
              <SiteCardView
                site={category === StructureType.Camp ? "Camp" : "Beasts"}
                beast={{ ...beast, combatClass: "Knight" }}
                army={{ art: "knight-t1", troops: 1500 }}
                guard={guard}
                fight={{
                  outcome: "wins",
                  exchanges: 1,
                  troopsLost: 50,
                  guardLeft: 0,
                  whole: { troopsLost: 50, guardKilled: guard, stamina: 30 },
                }}
                pay={category === StructureType.Camp ? { icon: "labor", amount: 550 } : null}
                xp={30}
                verb={null}
                onClose={() => {}}
              />
            </article>
          );
        })}
      </div>
      <section data-blitz-camp>
        <HudPanel title="Blitz · Camp" icon={structureMeaning(StructureType.Camp, "blitz")} collapsible={false}>
          <Icon name={structureMeaning(StructureType.Camp, "blitz")} size={64} alt="Blitz camp" />
          <p>Blitz keeps the camp structure. Frontier camps use their Troll guard.</p>
        </HudPanel>
      </section>
    </main>
  );
}
