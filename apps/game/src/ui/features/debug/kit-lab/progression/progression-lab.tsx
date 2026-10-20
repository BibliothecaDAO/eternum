import { useHudMode } from "@/hooks/use-hud-mode";
import { HudTabs } from "@/ui/design-system/kit/hud-elements";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { ArmyCharacter, ArmyStats, ArmyToday, ArmyTracks } from "./army-options";
import { EARLY_ARMY, EARLY_REALM, MID_REALM, VETERAN_ARMY } from "./progression-facts";
import { ResearchBranches, ResearchLadders, ResearchNext, ResearchToday } from "./research-options";

/**
 * Dev only: the owner's progression ask (20 October: "Think skill tree there", "an army detail panel as well to see its
 * stats, xp, levels etc and level up options"), at /lab/kit/progression. Research and the army detail, each today and
 * in three proposals at the width of Frontier's page place (440 px), on two realms: the owner's own (`?realm=early`, the
 * default, with Army 1 at 12 XP) and one some days in (`?realm=mid`, a veteran army). `?part=research|army` shows one
 * half; `?option=a|b|c|today` one proposal alone at the screen's width, for a phone (390 x 844). Every figure is the
 * Frontier preset's; nothing reads a game.
 */
export const ProgressionLab = () => {
  useHudMode("frontier");
  const [params, setParams] = useSearchParams();
  const mid = params.get("realm") === "mid";
  const realm = mid ? MID_REALM : EARLY_REALM;
  const army = mid ? VETERAN_ARMY : EARLY_ARMY;
  const part = params.get("part");
  const option = params.get("option");
  const set = (key: string, value: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === null) next.delete(key);
      else next.set(key, value);
      return next;
    });

  const research = {
    today: <ResearchToday realm={realm} />,
    a: <ResearchBranches key={realm.essence} realm={realm} />,
    b: <ResearchLadders key={realm.essence} realm={realm} />,
    c: <ResearchNext key={realm.essence} realm={realm} />,
  };
  const armies = {
    today: <ArmyToday army={army} />,
    a: <ArmyCharacter key={army.xp} army={army} />,
    b: <ArmyTracks key={army.xp} army={army} />,
    c: <ArmyStats key={army.xp} army={army} />,
  };

  if (option && option in research) {
    const shown = (part === "army" ? armies : research)[option as keyof typeof research];
    return (
      <Ground>
        <div data-lab={`${part ?? "research"}-${option}`} className="mx-auto w-full max-w-[440px] p-2">
          {shown}
        </div>
      </Ground>
    );
  }

  return (
    <Ground>
      <div className="flex flex-col gap-6 p-6">
        <header className="flex flex-wrap items-center gap-4">
          <h1 className="text-hud-display text-hud-ink">Progression · options for the owner</h1>
          <HudTabs
            tabs={[
              { key: "early", label: "Your realm (20 Oct)" },
              { key: "mid", label: "Some days in" },
            ]}
            value={mid ? "mid" : "early"}
            onChange={(value) => set("realm", value === "mid" ? "mid" : null)}
          />
          <HudTabs
            tabs={[
              { key: "all", label: "Both" },
              { key: "research", label: "Research" },
              { key: "army", label: "Army" },
            ]}
            value={part ?? "all"}
            onChange={(value) => set("part", value === "all" ? null : value)}
          />
        </header>
        {part !== "army" && (
          <Row title="Research: what is unlocked, what comes next, what each costs and needs, why one is locked">
            <Column name="Today" note="Rows and a castle row; each opens a sheet over the page.">
              {research.today}
            </Column>
            <Column name="A · Branches" note="The tree as a tree: three branches, lines where one opens another.">
              {research.a}
            </Column>
            <Column name="B · Ladders" note="One line per node, its levels as steps; a locked line says why.">
              {research.b}
            </Column>
            <Column name="C · What's next" note="Ready now, saving up, locked with the step that opens it.">
              {research.c}
            </Column>
          </Row>
        )}
        {part !== "research" && (
          <Row title="Army detail: stats, XP, levels and the level-up choices, opened from the army's row">
            <Column name="Today" note="The row; its sheet opens only through Upgrade.">
              {armies.today}
            </Column>
            <Column name="A · Character sheet" note="Figures as a grid, the four level-ups as choices.">
              {armies.a}
            </Column>
            <Column name="B · Tracks" note="Each attribute's five levels in view, the next one lit.">
              {armies.b}
            </Column>
            <Column name="C · Stats, then Level up" note="A plain table; Level up turns the panel to the choices.">
              {armies.c}
            </Column>
          </Row>
        )}
      </div>
    </Ground>
  );
};

/** Frontier's ground under the panels, as the HUD lab draws it. */
const Ground = ({ children }: { children: ReactNode }) => (
  <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]">
    {children}
  </div>
);

const Row = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-hud-title text-hud-ink">{title}</h2>
    <div className="flex items-start gap-6">{children}</div>
  </section>
);

const Column = ({ name, note, children }: { name: string; note: string; children: ReactNode }) => (
  <div data-lab={name} className="flex w-[440px] shrink-0 flex-col gap-2">
    <span className="text-hud-title text-hud-gold">{name}</span>
    <span className="min-h-10 text-hud-label text-hud-muted">{note}</span>
    {children}
  </div>
);
