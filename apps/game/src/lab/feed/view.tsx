import { HudTabs } from "@/ui/design-system/kit/hud-elements";
import { useSearchParams } from "react-router-dom";

import type { FeedOption } from "./options";
import { RECORDED_FEED } from "./recorded-feed";
import { type StillDevice, type StillFrame, stillUrl } from "./stills";

/** Each option: its name, and the one sentence that says what it changes. */
const FEED_OPTIONS: Record<FeedOption, { name: string; line: string }> = {
  a: {
    name: "A · Named lines",
    line: "Today's line, led by who did it, with the act's own painting and the reward at the end.",
  },
  b: {
    name: "B · Who, act, what",
    line: "A strategy game's kill feed: the player's face, the act as a painting, what it was done to as a painting.",
  },
  c: {
    name: "C · One card per run",
    line: "A player's run of play as one card: their explorations summed in one line, every other act below it.",
  },
};

const DEVICE_WORDS: Record<StillDevice, string> = { desktop: "desktop rail", phone: "phone" };

/**
 * Dev only: the Feed's options for the owner to pick (26 Oct 2026, HUD → Feed · to pick), each beside today's Feed, as
 * still screenshots of prod's recorded page (capture:feed takes them from draw.tsx): who did what on every row, a reward
 * under one without its amount, a Feed that fills the rail and closes, the phone's Log named the Feed. `option` names
 * the option, the lab's `device` the stills.
 */
export const FeedLabView = () => {
  const [params, setParams] = useSearchParams();
  const option = (["a", "b", "c"] as const).find((key) => key === params.get("option")) ?? "a";
  const device = params.get("device");
  const devices: StillDevice[] = device === "desktop" || device === "phone" ? [device] : ["desktop", "phone"];
  const choose = (key: string) =>
    setParams((current) => {
      current.set("option", key);
      return current;
    });
  return (
    <main className="min-h-full bg-hud-dark p-4 font-sans text-hud-ink" data-lab="feed">
      <header className="mb-3 flex flex-col gap-1">
        <h1 className="text-hud-title">The Feed: who did what, on every row</h1>
        <p className="max-w-[72rem] text-hud-label text-hud-muted">
          Prod's Frontier feed as it read on {RECORDED_FEED.pulledAt.slice(0, 16).replace("T", " ")} UTC, seen by djizus
          (gold), at the same stories in every still: today's Feed on the left, the option on the right. Every option
          fills the rail as Research and the Season do, and closes (× in its head; the Feed bubble opens it again).
        </p>
      </header>
      <HudTabs
        tabs={(Object.keys(FEED_OPTIONS) as FeedOption[]).map((key) => ({ key, label: FEED_OPTIONS[key].name }))}
        value={option}
        onChange={choose}
      />
      <p className="my-2 text-hud-body">{FEED_OPTIONS[option].line}</p>
      {devices.map((each) => (
        <div key={each} className="mb-4 flex flex-wrap items-start gap-6">
          <Still frame="today" device={each} caption={`Today · ${DEVICE_WORDS[each]}`} />
          <Still frame={option} device={each} caption={`${FEED_OPTIONS[option].name} · ${DEVICE_WORDS[each]}`} />
        </div>
      ))}
      {devices.includes("desktop") && (
        <Still
          name="a-desktop-closed"
          caption="Every option, closed: the rail keeps Next up and chat, the Feed bubble lit off"
        />
      )}
    </main>
  );
};

const Still = (props: { caption: string } & ({ frame: StillFrame; device: StillDevice } | { name: string })) => {
  const name = "name" in props ? props.name : `${props.frame}-${props.device}`;
  return (
    <figure className="flex flex-col gap-1">
      <img src={stillUrl(name)} alt={props.caption} data-still={name} className="rounded border border-hud-line" />
      <figcaption className="text-hud-label text-hud-muted">{props.caption}</figcaption>
    </figure>
  );
};
