import { HudTabs } from "@/ui/design-system/kit/hud-elements";
import { useSearchParams } from "react-router-dom";

import { PLACES, type StillDevice, stillName, stillUrl, type TierLook, type TierPlace } from "./stills";

type Draft = Exclude<TierLook, "pips">;

/** Each draft: its name, and the one sentence that says what it shows. */
const DRAFTS: Record<Draft, { name: string; line: string }> = {
  gem: {
    name: "A · Numeral gem",
    line: "A gem in the tier's rarity colour with its numeral, I to V, as Civilization and Age of Empires number their eras.",
  },
  word: {
    name: "B · Tier word",
    line: "The tier's name in its rarity colour, as loot reads in WoW, Diablo or Destiny; Common greyed.",
  },
  frame: {
    name: "C · Rarity frame",
    line: "No badge: the thing itself takes a frame in its rarity colour, glowing at Legendary, as Hearthstone frames its cards; Common plain.",
  },
};

const PLACE_WORDS: Record<TierPlace, string> = {
  research: "Research panel (C)",
  build: "Build card: the Barracks tier it waits for",
  army: "Army attributes",
};
const DEVICE_WORDS: Record<StillDevice, string> = { desktop: "desktop rail", phone: "phone" };

/**
 * Dev only: tier indicators to replace the pips, for the owner to pick (26 Oct 2026, HUD → Tier indicator · to pick):
 * owner, "I think we should remove the pips and replace them with another indicator, its time to do so". Each place a
 * tier is drawn, today's pips beside the draft, as still screenshots, never a live frame. `draft` names the draft, the
 * lab's `device` the stills.
 */
export const TierIndicatorLabView = () => {
  const [params, setParams] = useSearchParams();
  const draft = (Object.keys(DRAFTS) as Draft[]).find((key) => key === params.get("draft")) ?? "gem";
  const device = params.get("device");
  const devices: StillDevice[] = device === "desktop" || device === "phone" ? [device] : ["desktop", "phone"];
  const choose = (key: string) =>
    setParams((current) => {
      current.set("draft", key);
      return current;
    });
  return (
    <main className="min-h-full bg-hud-dark p-4 font-sans text-hud-ink" data-lab="tier-indicator">
      <header className="mb-3 flex flex-col gap-1">
        <h1 className="text-hud-title">A tier at a glance, in place of the pips</h1>
        <p className="max-w-[72rem] text-hud-label text-hud-muted">
          The same realm and army in every still, in the game's rarity colours (bronze to gold): today's pips on the
          left, the draft on the right. Next season each side of a row levels on its own and a building shows its
          highest tier, which every draft shows the same way.
        </p>
      </header>
      <HudTabs
        tabs={(Object.keys(DRAFTS) as Draft[]).map((key) => ({ key, label: DRAFTS[key].name }))}
        value={draft}
        onChange={choose}
      />
      <p className="my-2 text-hud-body">{DRAFTS[draft].line}</p>
      {PLACES.map((place) => (
        <section key={place} className="mb-5 flex flex-col gap-2">
          <h2 className="text-hud-strong">{PLACE_WORDS[place]}</h2>
          {devices.map((each) => (
            <div key={each} className="flex flex-wrap items-start gap-6">
              <Still name={stillName(place, "pips", each)} caption={`Today · ${DEVICE_WORDS[each]}`} />
              <Still name={stillName(place, draft, each)} caption={`${DRAFTS[draft].name} · ${DEVICE_WORDS[each]}`} />
            </div>
          ))}
        </section>
      ))}
    </main>
  );
};

const Still = ({ name, caption }: { name: string; caption: string }) => (
  <figure className="flex max-w-full flex-col gap-1">
    <img src={stillUrl(name)} alt={caption} data-still={name} className="max-w-full rounded border border-hud-line" />
    <figcaption className="text-hud-label text-hud-muted">{caption}</figcaption>
  </figure>
);
