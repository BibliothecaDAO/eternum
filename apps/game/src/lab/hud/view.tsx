import { HUD_LAB_STATES } from "@/ui/features/debug/kit-lab/hud-lab";
import { UNIFIED_VIEWS } from "@/ui/features/debug/kit-lab/unified-hud-lab";
import { useLayoutEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./view.css";

type Game = "blitz" | "frontier";
interface Shown {
  /** Its name in the address (`show`). */
  key: string;
  label: string;
  path: string;
}
interface Group {
  title: string;
  items: Shown[];
}

/** The Frontier HUD lab's states, by the moment of play their name says. */
const MOMENTS: { title: string; test: RegExp }[] = [
  { title: "Sites & fights", test: /^(site|fight|clear)-/ },
  { title: "Deploy", test: /^deploy/ },
  { title: "Realm & build", test: /^(build|castle|realm-full|stores)/ },
  { title: "Research", test: /^research/ },
  { title: "Next up", test: /^next-up-/ },
  { title: "The day", test: /^(last-hour|day-done|night|today|notice)/ },
  { title: "Season & purse", test: /^(season|value-|purse|withdraw|realms)/ },
];

const state = (name: string): Shown => ({ key: `state:${name}`, label: name, path: `/lab/kit/hud/${name}` });
const desktop = (name: string): Shown => ({ key: `view:${name}`, label: name, path: `/lab/kit/unified/${name}` });
const part = (name: string, label: string, path = `/lab/kit/${name}`): Shown => ({ key: `part:${name}`, label, path });

const CHAT = part("chat", "Chat");
/** What the HUD room lists for each game: the HUD as the game mounts it, its states, then the parts drawn alone. */
const LISTS: Record<Game, Group[]> = {
  frontier: [
    {
      title: "As the game mounts it",
      items: UNIFIED_VIEWS.filter((view) => view.frontier).map((view) => desktop(view.name)),
    },
    ...MOMENTS.map(({ title, test }) => ({
      title,
      items: HUD_LAB_STATES.filter((name) => test.test(name)).map(state),
    })),
    {
      title: "Map & army",
      items: HUD_LAB_STATES.filter((name) => !MOMENTS.some(({ test }) => test.test(name))).map(state),
    },
    { title: "Parts", items: [part("progression", "Research tree & army panel"), CHAT] },
  ],
  blitz: [
    {
      title: "As the game mounts it",
      items: UNIFIED_VIEWS.filter((view) => !view.frontier).map((view) => desktop(view.name)),
    },
    {
      title: "Parts",
      items: [
        part("guidance", "Guidance"),
        part("build-order", "Build order"),
        part("blitz-build", "Build on a plot"),
        part("construction", "Construction cards"),
        part("deploy", "Deploy"),
        part("panels", "Panels"),
        part("area-d", "Area D"),
        part("windows", "Windows", "/lab/kit/windows/build"),
        CHAT,
      ],
    },
  ],
};

const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;
const GAP = 24;

/**
 * Dev only: the in-game HUD, every state and part the lab draws for the game switched to, on a desktop and a phone side
 * by side (HUD → In game). Each frame is the state's own lab address at that device's size, so the phone's layout and
 * CSS are the game's own; `show` names the state, `device` the frames (both, desktop or phone).
 */
export const HudRoomView = () => {
  const [params, setParams] = useSearchParams();
  const game: Game = params.get("mode") === "blitz" ? "blitz" : "frontier";
  const groups = LISTS[game];
  const all = groups.flatMap((group) => group.items);
  const shown = all.find((item) => item.key === params.get("show")) ?? all[0]!;
  const device = params.get("device");
  const frames = device === "desktop" || device === "phone" ? [SIZES[device]] : [SIZES.desktop, SIZES.phone];
  const show = (key: string) =>
    setParams((current) => {
      current.set("show", key);
      return current;
    });
  return (
    <div className="hud-room">
      <nav className="hud-room-list" aria-label="HUD states">
        {groups.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-current={item === shown ? "true" : undefined}
                onClick={() => show(item.key)}
              >
                {item.label}
              </button>
            ))}
          </section>
        ))}
      </nav>
      <Frames shown={shown} frames={frames} />
    </div>
  );
};

const Frames = ({ shown, frames }: { shown: Shown; frames: { width: number; height: number }[] }) => {
  const stage = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    // The stage's content box: its padding (16 px a side) and the line and captions above and below the frames.
    const measure = () => setRoom({ width: element.clientWidth - 32, height: element.clientHeight - 80 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // One scale for every frame, the largest that fits them side by side.
  const width = frames.reduce((sum, frame) => sum + frame.width, 0) + GAP * (frames.length - 1);
  const height = Math.max(...frames.map((frame) => frame.height));
  const scale = Math.min(
    1,
    (room.width - GAP * (frames.length - 1)) / (width - GAP * (frames.length - 1)),
    room.height / height,
  );
  return (
    <div className="hud-room-stage" ref={stage}>
      <p>
        <strong>{shown.label}</strong> · <Link to={shown.path}>open alone</Link>
      </p>
      <div className="hud-room-frames">
        {scale > 0 &&
          frames.map((frame) => (
            <figure key={frame.width}>
              <div style={{ width: frame.width * scale, height: frame.height * scale }}>
                <iframe
                  title={`${shown.label} at ${frame.width} × ${frame.height}`}
                  src={`${shown.path}?capture=1`}
                  style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}
                />
              </div>
              <figcaption>
                {frame.width === SIZES.phone.width ? "Phone" : "Desktop"} · {frame.width} × {frame.height}
              </figcaption>
            </figure>
          ))}
      </div>
    </div>
  );
};
