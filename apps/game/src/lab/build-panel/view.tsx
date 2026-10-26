import { HudTabs } from "@/ui/design-system/kit/hud-elements";
import { useSearchParams } from "react-router-dom";

import { type PanelLook, type StillDevice, stillName, type StillStep, stillUrl, STEPS } from "./stills";

type Draft = Exclude<PanelLook, "today">;

/** Each draft: its name, where Build is and where the pick lands, and what it costs. */
const DRAFTS: Record<Draft, { name: string; line: string; cost: string }> = {
  a: {
    name: "A · Build place, plots lit",
    line: "Build joins the places (desktop: before Research; phone: a sixth slot), dot while something can go up. The plot's build cards open in the rail; every free plot lights up and the pick follows the pointer. Tap a plot to build.",
    cost: "One more place. The board's lighting and ghost exist already. On a phone a lit plot builds on the tap, with no preview first.",
  },
  b: {
    name: "B · Build place, next free plot",
    line: "The same place and dot. The pick stands on the next free plot by the castle: Build lands it in one press. A tap on another plot moves it there, as today.",
    cost: "One more place, and a reader for the next free plot. The card is today's plot card.",
  },
  c: {
    name: "C · Build on the realm",
    line: "No new place: Build sits on the realm card (desktop) and on the realm's board (phone, over the bar, only there). Then as A: plots lit, tap one.",
    cost: "No new place in the bars. On a phone Build shows only on the realm's board.",
  },
};

const STEP_WORDS: Record<StillStep, string> = { entry: "where Build is", open: "Build pressed" };
const TODAY_WORDS: Record<StillStep, string> = {
  entry: "Today: nothing says Build",
  open: "Today: the realm's board, an empty plot tapped",
};
const DEVICE_WORDS: Record<StillDevice, string> = { desktop: "desktop", phone: "phone" };

/**
 * Dev only: a desktop Build panel, for the owner to pick (26 Oct 2026, HUD → Build panel · to pick). Owner: "I kinda
 * think on desktop we're missing a build panel that would open up on the right side ? not sure tho". Today's way to
 * build beside each draft, before and after Build is pressed, as still screenshots, never a live frame. `draft` names
 * the draft, the lab's `device` the stills.
 */
export const BuildPanelLabView = () => {
  const [params, setParams] = useSearchParams();
  const draft = (Object.keys(DRAFTS) as Draft[]).find((key) => key === params.get("draft")) ?? "b";
  const device = params.get("device");
  const devices: StillDevice[] = device === "desktop" || device === "phone" ? [device] : ["desktop", "phone"];
  const choose = (key: string) =>
    setParams((current) => {
      current.set("draft", key);
      return current;
    });
  return (
    <main className="min-h-full bg-hud-dark p-4 font-sans text-hud-ink" data-lab="build-panel">
      <header className="mb-3 flex flex-col gap-1">
        <h1 className="text-hud-title">A Build panel on the HUD</h1>
        <p className="max-w-[72rem] text-hud-label text-hud-muted">
          The same realm in every still: a City with free plots and 12K labor. Each panel is the plot's own build cards;
          tapping an empty plot still opens them.
        </p>
      </header>
      <HudTabs
        tabs={(Object.keys(DRAFTS) as Draft[]).map((key) => ({ key, label: DRAFTS[key].name }))}
        value={draft}
        onChange={choose}
      />
      <p className="mt-2 text-hud-body">{DRAFTS[draft].line}</p>
      <p className="mb-2 text-hud-label text-hud-muted">{DRAFTS[draft].cost}</p>
      {devices.map((each) =>
        STEPS.map((step) => (
          <section key={`${each}-${step}`} className="mb-5 flex flex-col gap-2">
            <h2 className="text-hud-strong">{`${DEVICE_WORDS[each]} · ${STEP_WORDS[step]}`}</h2>
            <div className="flex flex-wrap items-start gap-6">
              <Still name={stillName("today", each, step)} caption={TODAY_WORDS[step]} />
              <Still name={stillName(draft, each, step)} caption={DRAFTS[draft].name} />
            </div>
          </section>
        )),
      )}
    </main>
  );
};

const Still = ({ name, caption }: { name: string; caption: string }) => (
  <figure className="flex max-w-3xl flex-col gap-1">
    <img src={stillUrl(name)} alt={caption} data-still={name} className="max-w-full rounded border border-hud-line" />
    <figcaption className="text-hud-label text-hud-muted">{caption}</figcaption>
  </figure>
);
