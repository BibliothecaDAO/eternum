import { useHudMode } from "@/hooks/use-hud-mode";
import { HudButton, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { BALANCE_QUESTIONS, BLITZ_TILES, FRONTIER_DAYS, FRONTIER_TILES, PULL, UNUSED } from "./data-snapshot";
import { INVENTORY, type Verdict } from "./inventory";
import { STRUCTURES, type Mode, type Page, type Room, type Structure } from "./structures";

const MODE_NAMES: Record<Mode, string> = { blitz: "Blitz", frontier: "Frontier", eternum: "Eternum" };
type Device = "desktop" | "phone" | "both";
const DEVICES: Device[] = ["desktop", "phone", "both"];

/**
 * Dev only: the three structures proposed for one lab, each a clickable mockup of its header, rooms and pages, for the
 * owner to pick from (25 October 2026, reports/lab-redesign-1.md). Every choice is in the address, as it would be in the
 * built lab: `option`, `room`, `page`, `mode`, `device`.
 */
export const LabOptionsView = () => {
  useHudMode("frontier");
  const [params, setParams] = useSearchParams();
  const option = params.get("option") ?? "b";
  const structure = STRUCTURES.find((entry) => entry.key === option);
  const choose = (next: Record<string, string>) => setParams({ option, ...next });
  return (
    <main className="min-h-full bg-kit-ground p-4 text-hud-ink sm:p-6" data-lab="options">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="text-hud-label uppercase tracking-wide text-hud-muted">Lab redesign · pick one</p>
          <h1 className="text-hud-display">One lab for Blitz, Frontier and Eternum</h1>
          <p className="max-w-3xl text-hud-body text-hud-muted">
            Three structures for the same pages. Click a room, then a page; switch the game and the device. Nothing here
            is built yet: each page is a stand-in that names the pages it replaces.
          </p>
        </header>
        <HudTabs
          tabs={[
            ...STRUCTURES.map((entry) => ({ key: entry.key as string, label: entry.name })),
            { key: "inventory", label: `Today's lab · ${INVENTORY.length} pages` },
          ]}
          value={option}
          onChange={(key) => setParams({ option: key })}
        />
        {structure ? (
          <Mockup key={structure.key} structure={structure} params={params} choose={choose} />
        ) : (
          <InventoryTable />
        )}
      </div>
    </main>
  );
};

const Mockup = ({
  structure,
  params,
  choose,
}: {
  structure: Structure;
  params: URLSearchParams;
  choose: (next: Record<string, string>) => void;
}) => {
  const room = structure.rooms.find((entry) => entry.title === params.get("room")) ?? structure.rooms[0]!;
  const page = room.pages.find((entry) => entry.title === params.get("page")) ?? room.pages[0]!;
  const asked = params.get("mode") as Mode | null;
  // Frontier is the game being played; a page that draws it opens on it.
  const mode: Mode =
    asked && page.modes.includes(asked) ? asked : page.modes.includes("frontier") ? "frontier" : page.modes[0]!;
  const device = (DEVICES as string[]).includes(params.get("device") ?? "") ? (params.get("device") as Device) : "both";
  const devices = page.stage === "hud" || page.stage === "sheet" || page.stage === "app";
  const set = (next: Record<string, string>) => choose({ room: room.title, page: page.title, mode, device, ...next });
  const pages = structure.rooms.reduce((sum, entry) => sum + entry.pages.length, 0);
  const questions = new Set(structure.rooms.flatMap((entry) => entry.pages.filter((one) => one.question)));
  return (
    <section className="flex flex-col gap-4">
      <p className="text-hud-body">{structure.idea}</p>
      <div className="overflow-hidden rounded-lg border border-hud-line-strong bg-hud-dark">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hud-line px-4 py-3">
          <span className="text-hud-strong text-hud-gold">Lab</span>
          <nav className="flex flex-wrap gap-1" aria-label="Rooms">
            {structure.rooms.map((entry) => (
              <button
                key={entry.title}
                type="button"
                aria-pressed={entry === room}
                onClick={() => choose({ room: entry.title, mode, device })}
                className={`rounded px-3 py-1.5 text-hud-body ${entry === room ? "bg-hud-chosen text-hud-ink" : "text-hud-muted hover:bg-hud-hover"}`}
              >
                {entry.title}
                {entry.pages.some((one) => one.question) && entry.title !== "Decide" && (
                  <span className="ml-1 text-hud-gold" title="holds a question for you">
                    ●
                  </span>
                )}
                {entry.title === "Decide" && <span className="ml-1 text-hud-gold">{entry.pages.length}</span>}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-hud-label">
            <Switch
              label="Game"
              value={mode}
              options={page.modes}
              names={MODE_NAMES}
              onChange={(next) => set({ mode: next })}
            />
            {devices && (
              <Switch
                label="Device"
                value={device}
                options={DEVICES}
                names={{ desktop: "Desktop", phone: "Phone", both: "Both" }}
                onChange={(next) => set({ device: next })}
              />
            )}
          </div>
        </div>
        <div className="grid min-h-[560px] md:grid-cols-[220px_1fr]">
          <aside className="flex flex-col gap-1 border-b border-hud-line p-3 md:border-b-0 md:border-r">
            <p className="px-2 pb-1 text-hud-label text-hud-muted">{room.job}</p>
            {room.pages.map((entry) => (
              <button
                key={entry.title}
                type="button"
                aria-pressed={entry === page}
                onClick={() => set({ page: entry.title })}
                className={`flex items-center justify-between rounded px-2 py-1.5 text-left text-hud-body ${entry === page ? "bg-hud-chosen" : "hover:bg-hud-hover"}`}
              >
                {entry.title}
                {entry.question && <span className="text-hud-gold">●</span>}
              </button>
            ))}
          </aside>
          <div className="flex min-w-0 flex-col gap-4 p-4">
            <PageStage page={page} mode={mode} device={device} room={room} />
            <Replaces page={page} />
          </div>
        </div>
      </div>
      <dl className="grid gap-3 text-hud-body sm:grid-cols-2 lg:grid-cols-4">
        <Fact term="Top-level entries" detail={`${structure.rooms.length}`} />
        <Fact term="Pages" detail={`${pages}, in place of ${INVENTORY.length} today`} />
        <Fact term="Open questions" detail={`${questions.size}`} />
        <Fact term="Game and device" detail="One switch each, in the address, offering only what the page draws" />
      </dl>
      <div className="grid gap-3 text-hud-body md:grid-cols-2">
        <Rule title="A lane adds a page">{structure.adding}</Rule>
        <Rule title="It loads">
          Each room and each page is its own lazy chunk; a room's list is drawn from the registry, not from its pages'
          code. A 3D page starts its renderer only when opened, one at a time. Today, any /lab/kit page loads all 20 kit
          pages (764 client modules for the token page).
        </Rule>
      </div>
    </section>
  );
};

const Switch = <K extends string>({
  label,
  value,
  options,
  names,
  onChange,
}: {
  label: string;
  value: K;
  options: readonly K[];
  names: Record<K, string>;
  onChange: (next: K) => void;
}) => (
  <span className="flex items-center gap-1" role="group" aria-label={label}>
    <span className="text-hud-muted">{label}</span>
    {options.map((key) => (
      <button
        key={key}
        type="button"
        aria-pressed={key === value}
        onClick={() => onChange(key)}
        className={`rounded border px-2 py-1 ${key === value ? "border-hud-gold text-hud-ink" : "border-hud-line text-hud-muted"}`}
      >
        {names[key]}
      </button>
    ))}
  </span>
);

const Fact = ({ term, detail }: { term: string; detail: string }) => (
  <div className="rounded border border-hud-line bg-hud-surface p-3">
    <dt className="text-hud-label text-hud-muted">{term}</dt>
    <dd className="text-hud-strong">{detail}</dd>
  </div>
);

const Rule = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded border border-hud-line p-3">
    <h3 className="text-hud-strong text-hud-gold">{title}</h3>
    <p className="text-hud-muted">{children}</p>
  </div>
);

/** The routes a page replaces; each one that exists on this build opens today's page. */
const Replaces = ({ page }: { page: Page }) => (
  <div className="text-hud-label text-hud-muted">
    Replaces:{" "}
    {page.from.map((from, index) => (
      <span key={from}>
        {index > 0 && " · "}
        {/^\/lab[^\s:]*$/.test(from) ? (
          <Link className="underline" to={from}>
            {from}
          </Link>
        ) : (
          from
        )}
      </span>
    ))}
  </div>
);

const PageStage = ({ page, mode, device, room }: { page: Page; mode: Mode; device: Device; room: Room }) => {
  if (page.stage === "decide") return <DecideCard page={page} />;
  if (page.stage === "data") return <BalanceAndData mode={mode} question={page.question} />;
  if (page.stage === "hud" && !page.question) return <HudFrames mode={mode} device={device} />;
  return (
    <div className="flex min-h-[320px] flex-col justify-center gap-2 rounded border border-dashed border-hud-line p-6">
      <h2 className="text-hud-title">
        {page.title} · {MODE_NAMES[mode]}
      </h2>
      <p className="text-hud-muted">{STAND_IN[page.stage]}</p>
      {page.question && <p className="text-hud-gold">Question: {page.question}</p>}
      {room.title === "Decide" || <span className="text-hud-label text-hud-muted">In room: {room.title}</span>}
    </div>
  );
};

const STAND_IN: Record<Page["stage"], string> = {
  sheet: "The sheet as today, its Mode and Device now the lab's own switches, so a link keeps them.",
  hud: "The proposal's page as its lane built it, inside the lab's frames.",
  app: "The app's pages over their fixtures, a desktop and a phone side by side.",
  scene: "A 3D scene: nothing is loaded until you open it, and it is released when you leave.",
  art: "The art page as today, under the lab's switches; its renderer starts when it opens.",
  bench: "The runners' targets, each with its command. Kept for the runners; nothing here is for review.",
  film: "The film set, or the footage and pages made with it.",
  data: "",
  decide: "",
};

/**
 * The HUD on both devices at once: each frame is the same lab route at that device's size, so the phone's own layout
 * and CSS apply. Nothing loads until asked: each frame boots its own copy of the client.
 */
const HudFrames = ({ mode, device }: { mode: Mode; device: Device }) => {
  const [live, setLive] = useState(false);
  const desktop = `/lab/kit/unified/${mode}?capture=1`;
  const phone = desktop;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-hud-title">In game · {MODE_NAMES[mode]}</h2>
        <span className="text-hud-label text-hud-muted">
          One list of states, by moment: map, army, sites and fights, realm and build, research, day, season and purse,
          windows, chat.
        </span>
        <HudButton kind="secondary" size="sm" onClick={() => setLive(!live)}>
          {live ? "Stop the frames" : "Load today's HUD in the frames"}
        </HudButton>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        {device !== "phone" && (
          <Frame label="Desktop · 1440 × 900" width={1440} height={900} scale={0.42} src={live ? desktop : undefined} />
        )}
        {device !== "desktop" && (
          <Frame label="Phone · 390 × 844" width={390} height={844} scale={0.45} src={live ? phone : undefined} />
        )}
      </div>
    </div>
  );
};

const Frame = ({
  label,
  width,
  height,
  scale,
  src,
}: {
  label: string;
  width: number;
  height: number;
  scale: number;
  src?: string;
}) => (
  <figure className="flex flex-col gap-1">
    <div
      className="overflow-hidden rounded border border-hud-line-strong bg-hud-night"
      style={{ width: width * scale, height: height * scale }}
    >
      {src ? (
        <iframe
          title={label}
          src={src}
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0 }}
        />
      ) : (
        <div className="grid h-full place-content-center p-2 text-center text-hud-label text-hud-muted">
          {width < 600 ? "Phone frame" : "Desktop frame"}
        </div>
      )}
    </div>
    <figcaption className="text-hud-label text-hud-muted">{label}</figcaption>
  </figure>
);

const DecideCard = ({ page }: { page: Page }) => (
  <div className="flex flex-col gap-3 rounded border border-hud-gold p-5">
    <p className="text-hud-label uppercase tracking-wide text-hud-muted">Waiting for you</p>
    <h2 className="text-hud-title">{page.question}</h2>
    <p className="text-hud-body text-hud-muted">
      The card opens the page in its room. Answered, the card goes, and the page leaves the lab in the change that ships
      the answer.
    </p>
    <p className="text-hud-label text-hud-muted">Page: {page.title}</p>
  </div>
);

/** Balance & data as one page: the newest pull's figures for the game switched to, then the balance study's options. */
const BalanceAndData = ({ mode, question }: { mode: Mode; question?: string }) => {
  const tiles = mode === "blitz" ? BLITZ_TILES : FRONTIER_TILES;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-hud-title">Balance & data · {MODE_NAMES[mode]}</h2>
        <span className="text-hud-label text-hud-muted">
          Pull {PULL.taken} · {PULL.block} · {PULL.where}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.line} className="rounded border border-hud-line bg-hud-surface p-3">
            <div className="text-hud-display text-hud-gold">{tile.figure}</div>
            <div className="text-hud-label text-hud-muted">{tile.line}</div>
          </div>
        ))}
      </div>
      {mode === "frontier" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <table className="text-hud-body">
            <caption className="pb-1 text-left text-hud-strong">Players by day</caption>
            <thead className="text-hud-label text-hud-muted">
              <tr>
                <th className="text-left">day</th>
                <th className="text-right">hours</th>
                <th className="text-right">settled</th>
                <th className="text-right">active</th>
              </tr>
            </thead>
            <tbody>
              {FRONTIER_DAYS.map((row) => (
                <tr key={row.day} className="border-t border-hud-line">
                  <td>{row.day}</td>
                  <td className="text-right">{row.hours}</td>
                  <td className="text-right">{row.settled}</td>
                  <td className="text-right">
                    <span
                      className="mr-2 inline-block h-2 bg-hud-gold align-middle"
                      style={{ width: row.active * 4 }}
                      aria-hidden
                    />
                    {row.active}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <h3 className="pb-1 text-hud-strong">Systems nobody uses</h3>
            <ul className="list-disc pl-5 text-hud-body text-hud-muted">
              {UNUSED.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {mode === "frontier" && (
        <div className="flex flex-col gap-3">
          <h3 className="text-hud-strong">
            Next season's research balance{question && <span className="ml-2 text-hud-gold">● {question}</span>}
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            {BALANCE_QUESTIONS.map((entry) => (
              <div key={entry.question} className="flex flex-col gap-1 rounded border border-hud-line p-3">
                <span className="text-hud-strong">{entry.question}</span>
                {entry.options.map((line, index) => (
                  <span key={line} className={index === entry.recommended ? "text-hud-ink" : "text-hud-muted"}>
                    {line}
                    {index === entry.recommended && <span className="ml-1 text-hud-gold">· recommended</span>}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="text-hud-label text-hud-muted">
            Each option keeps its interactive study (prices, capacity and the replay of the 28 observed beast clears).
          </p>
        </div>
      )}
      <p className="text-hud-label text-hud-muted">
        Rerun the pull: <code>{PULL.rerun}</code>. The built page reads the newest pull; a box without one says so.
      </p>
    </div>
  );
};

const VERDICTS: { key: Verdict | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "keep", label: "Keep" },
  { key: "merge", label: "Merge" },
  { key: "move", label: "Move" },
  { key: "proposal", label: "Proposal" },
  { key: "lost", label: "Lost" },
  { key: "delete", label: "Delete" },
];

/** Today's lab, page by page: what it shows, who opens it, where it lives, and what each structure does with it. */
const InventoryTable = () => {
  const [verdict, setVerdict] = useState<Verdict | "all">("all");
  const rows = INVENTORY.filter((entry) => verdict === "all" || entry.verdict === verdict);
  return (
    <section className="flex flex-col gap-3">
      <HudTabs
        tabs={VERDICTS.map((entry) => ({
          key: entry.key,
          label: entry.label,
          count: entry.key === "all" ? INVENTORY.length : INVENTORY.filter((one) => one.verdict === entry.key).length,
        }))}
        value={verdict}
        onChange={setVerdict}
      />
      <div className="overflow-x-auto">
        <table className="min-w-[900px] text-hud-label">
          <thead className="text-hud-muted">
            <tr className="text-left">
              <th>Route</th>
              <th>Page</th>
              <th>Shows</th>
              <th>Who opens it</th>
              <th>Game</th>
              <th>Touched</th>
              <th>Lives on</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.route} className="border-t border-hud-line align-top">
                <td className="pr-2 font-mono">{entry.route}</td>
                <td className="pr-2 text-hud-ink">{entry.title}</td>
                <td className="pr-2">{entry.shows}</td>
                <td className="pr-2">{entry.users}</td>
                <td className="pr-2">{entry.scope}</td>
                <td className="pr-2">{entry.touched}</td>
                <td className="pr-2">{entry.home}</td>
                <td>
                  <span className={entry.verdict === "lost" ? "text-hud-bad" : "text-hud-ink"}>{entry.verdict}</span>
                  {entry.note && <span className="block text-hud-muted">{entry.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
