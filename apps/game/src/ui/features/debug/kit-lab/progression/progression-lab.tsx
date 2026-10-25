import { useHudMode } from "@/hooks/use-hud-mode";
import { HudPanel, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { readArmyDetail } from "@/ui/features/frontier/army/army-detail";
import { ArmyDetail } from "@/ui/features/frontier/army/army-panel";
import { EARLY_ARMY, EARLY_REALM, MID_REALM, VETERAN_ARMY } from "@/ui/features/frontier/research/progression-fixture";
import { ResearchPanel } from "@/ui/features/frontier/research/research-panel";
import { readResearchTree, type RealmResearchFacts } from "@/ui/features/frontier/research/research-tree";
import { type ReactNode, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const noop = () => undefined;

/**
 * Dev only: Frontier's progression as the owner picked it (20 October: "Branches I believe is good for the progression.
 * For the army C is best."), at /lab/kit/progression: the Research tree and the army's detail, the game's own panels on
 * the Frontier preset's numbers, on the owner's realm (the default, with Army 1 at 12 XP) or one some days in
 * (`?realm=mid`, with a veteran army). `?part=research|army` shows one alone at the screen's width, for a phone.
 */
export const ProgressionLab = () => {
  useHudMode("frontier");
  const [params, setParams] = useSearchParams();
  const mid = params.get("realm") === "mid";
  const realm = mid ? MID_REALM : EARLY_REALM;
  const army = readArmyDetail(mid ? VETERAN_ARMY : EARLY_ARMY);
  const part = params.get("part");
  const research = <LabResearch key={String(mid)} realm={realm} />;
  const armyPanel = (choosing: boolean) => (
    <HudPanel title={army.name} icon="troops" collapsible={false} bodyClassName="px-3 pb-3">
      <ArmyDetail key={`${army.name}-${choosing}`} army={army} sending={false} choosing={choosing} onLevelUp={noop} />
    </HudPanel>
  );

  if (part === "research" || part === "army")
    return (
      <Ground>
        <div data-lab={part} className="mx-auto flex w-full max-w-[440px] flex-col gap-3 p-2">
          {part === "research" ? research : [armyPanel(false), armyPanel(true)]}
        </div>
      </Ground>
    );

  return (
    <Ground>
      <div className="flex flex-col gap-6 p-6">
        <header className="flex flex-wrap items-center gap-4">
          <h1 className="text-hud-display text-hud-ink">Progression</h1>
          <Link to="/lab/kit/research-balance/army-levels" className="text-hud-label text-hud-gold underline">
            Compare army levels
          </Link>
          <HudTabs
            tabs={[
              { key: "early", label: "Your realm (20 Oct)" },
              { key: "mid", label: "Some days in" },
            ]}
            value={mid ? "mid" : "early"}
            onChange={(value) => setParams(value === "mid" ? { realm: "mid" } : {})}
          />
        </header>
        <div className="flex items-start gap-6">
          <Column name="Research · Branches">{research}</Column>
          <Column name="Army · Stats">{armyPanel(false)}</Column>
          <Column name="Army · Level up">{armyPanel(true)}</Column>
        </div>
      </div>
    </Ground>
  );
};

/** The game's Research panel on a fixture realm, its picked node the lab's own. */
const LabResearch = ({ realm }: { realm: RealmResearchFacts }) => {
  const nodes = readResearchTree(realm);
  const [picked, setPicked] = useState(
    () => (nodes.find(({ state }) => state === "ready") ?? nodes.find(({ state }) => state === "short"))!.key,
  );
  return (
    <ResearchPanel
      nodes={nodes}
      essence={realm.essence}
      labor={realm.labor}
      picked={picked}
      onPick={setPicked}
      sending={new Set()}
      fixFor={() => undefined}
      onResearch={noop}
    />
  );
};

/** Frontier's ground under the panels, as the HUD lab draws it. */
const Ground = ({ children }: { children: ReactNode }) => (
  <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]">
    {children}
  </div>
);

const Column = ({ name, children }: { name: string; children: ReactNode }) => (
  <div data-lab={name} className="flex w-[440px] shrink-0 flex-col gap-2">
    <span className="text-hud-title text-hud-gold">{name}</span>
    {children}
  </div>
);
