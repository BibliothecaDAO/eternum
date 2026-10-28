import { useHudMode } from "@/hooks/use-hud-mode";
import { playerAvatarUrl } from "@/hooks/use-player-profile";
import { PageFrame } from "@/shell/frame/page-frame";
import { useLayout } from "@/shell/frame/layout";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppButton, AppChip, AppDialog, AppIconButton, AppPanel, AppTabs } from "@/ui/design-system/kit/app-elements";
import {
  HudButton,
  HudChip,
  HudField,
  HudIconButton,
  HudPanel,
  HudTabs,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { PlaceNav } from "@/ui/features/frontier/hud/place-nav";
import { createContext, Fragment, type ReactNode, useContext, useLayoutEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Dev only: the chat overhaul's designs at /lab/kit/chat-designs, for the owner's pick (stills on evidence/picks/chat).
 * `?design=a` one room everywhere, private messages whispered in it; `b` the place's room beside Messages; `c` every
 * room and conversation as a round. `&state=` busy, empty, reply, link (asked before leaving Realms), object (a
 * player's card from their name), scrolled (read up while new messages came) or, for b, inbox (its Messages).
 * `&place=app` draws it in the app (its kit, its frame) instead of a Frontier game. Desktop draws the rail's chat pane
 * (the app: a pane over the page), a phone the chat page over its place bar. Static: nothing here sends or reads.
 */
export const ChatDesignsLab = () => {
  useHudMode("frontier");
  const [params] = useSearchParams();
  const design = (params.get("design") ?? "a") as Design;
  const state = (params.get("state") ?? "busy") as State;
  const app = params.get("place") === "app";
  const phone = useLayout() !== "desktop";
  const chat = (
    <SkinContext.Provider value={app ? APP : HUD}>
      <ChatDesign design={design} state={state} phone={phone} app={app} />
    </SkinContext.Provider>
  );
  if (app) return <InTheApp chat={chat} phone={phone} link={state === "link"} />;
  return (
    <div
      data-lab="chat-designs"
      className="ui fixed inset-0 bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]"
    >
      {phone ? (
        <div className="absolute inset-0 flex flex-col gap-1.5 p-2">
          <div className="flex min-h-0 flex-1 flex-col">{chat}</div>
          <PlaceNav place="chat" onRealm={false} onGo={noop} researchDot events={2} unread={0} />
        </div>
      ) : (
        <div className="absolute bottom-4 right-3 flex h-hud-chat-pane w-hud-column flex-col">{chat}</div>
      )}
      {state === "link" && <LeavingRealms url={VIDEO} />}
    </div>
  );
};

type Design = "a" | "b" | "c";
type State = "busy" | "empty" | "reply" | "link" | "object" | "scrolled" | "inbox";

const noop = () => undefined;
const ME = "Maelis";

/**
 * What the chat is drawn with: the HUD's kit in a game, the app's kit in the app. One chat, its parts taken from the
 * surface it stands on.
 */
type Skin = {
  ink: string;
  muted: string;
  accent: string;
  gold: string;
  body: string;
  strong: string;
  label: string;
  chosen: string;
  hover: string;
  line: string;
  lineStrong: string;
  surface: string;
  Panel: (props: {
    title: ReactNode;
    icon?: IconMeaning;
    cue?: ReactNode;
    row?: boolean;
    children: ReactNode;
  }) => ReactNode;
  Chip: (props: { icon: IconMeaning; children: ReactNode; tone?: "good" }) => ReactNode;
  Button: (props: { primary?: boolean; children: ReactNode }) => ReactNode;
  IconButton: (props: { icon: IconMeaning; label: string }) => ReactNode;
  Field: (props: { value: string; placeholder: string }) => ReactNode;
  Tabs: (props: { tabs: { key: string; label: string; count?: number }[]; value: string }) => ReactNode;
};

const HUD: Skin = {
  ink: "text-hud-ink",
  muted: "text-hud-muted",
  accent: "text-hud-accent",
  gold: "text-hud-gold",
  body: "text-hud-body",
  strong: "text-hud-strong",
  label: "text-hud-label",
  chosen: "bg-hud-chosen",
  hover: "bg-hud-hover",
  line: "border-hud-line",
  lineStrong: "border-hud-line-strong",
  surface: "bg-hud-surface",
  Panel: ({ title, icon, cue, row = false, children }) => (
    <HudPanel
      title={title}
      icon={icon}
      cue={cue}
      collapsible={false}
      className="flex min-h-0 flex-1 flex-col"
      bodyClassName={cn("flex min-h-0 flex-1 p-0", row ? "flex-row" : "flex-col")}
    >
      {children}
    </HudPanel>
  ),
  Chip: ({ icon, children, tone }) => (
    <HudChip icons={[icon]} tone={tone} onPress={tone ? undefined : noop}>
      {children}
    </HudChip>
  ),
  Button: ({ primary = false, children }) => (
    <HudButton kind={primary ? "primary" : "secondary"} size="sm">
      {children}
    </HudButton>
  ),
  IconButton: ({ icon, label }) => <HudIconButton icon={icon} label={label} kind="quiet" size="sm" />,
  Field: ({ value, placeholder }) => (
    <HudField value={value} onChange={noop} placeholder={placeholder} aria-label="Message" />
  ),
  Tabs: ({ tabs, value }) => <HudTabs size="sm" tabs={tabs} value={value} onChange={noop} />,
};

const APP: Skin = {
  ink: "text-app-ink",
  muted: "text-app-muted",
  accent: "text-app-accent",
  gold: "text-app-gold",
  body: "text-app-body",
  strong: "text-app-strong",
  label: "text-app-label",
  chosen: "bg-app-chosen",
  hover: "bg-app-hover",
  line: "border-app-line",
  lineStrong: "border-app-line-strong",
  surface: "bg-app-surface",
  Panel: ({ title, icon, cue, row = false, children }) => (
    <AppPanel title={title} icon={icon} cue={cue} flush className="min-h-0 flex-1">
      {/* The panel's body grows with what it holds; the chat takes the body's height and asks for none of its own. */}
      <div className={cn("flex", row ? "flex-row" : "flex-col")} style={{ height: "100%", contain: "size" }}>
        {children}
      </div>
    </AppPanel>
  ),
  Chip: ({ icon, children, tone }) => (
    <AppChip icon={icon} tone={tone}>
      {children}
    </AppChip>
  ),
  Button: ({ primary = false, children }) => <AppButton kind={primary ? "primary" : "secondary"}>{children}</AppButton>,
  IconButton: ({ icon, label }) => <AppIconButton icon={icon} label={label} kind="quiet" onClick={noop} />,
  // The app's field, without the label line it draws over its box: the chat's field is named by its place.
  Field: ({ value, placeholder }) => (
    <label className="app-field">
      <span className="app-field__box">
        <input value={value} onChange={noop} placeholder={placeholder} aria-label="Message" />
      </span>
    </label>
  ),
  Tabs: ({ tabs, value }) => (
    <AppTabs
      label="Chat"
      value={value}
      tabs={tabs.map(({ key, label, count }) => ({
        key,
        label: count ? `${label} ${count}` : label,
        dot: Boolean(count),
      }))}
    />
  ),
};

const SkinContext = createContext<Skin>(HUD);
const useSkin = () => useContext(SkinContext);

/** A thing on the map a message carries: its art, its name, and whether today's map still holds it. */
type Thing = { icon: IconMeaning; name: string; gone?: boolean };
type Part = string | { link: string } | { thing: Thing } | { mention: string };
type Line = { id: string; who: string; at: string; parts: Part[]; replyTo?: string; whisper?: boolean };

const ADDRESSES: Record<string, string> = {
  djizus: "0x05d1c0de1",
  Nexonik: "0x05e7a11b2",
  BirthdayBoi: "0x0b1d7a3c4",
  vorpalsword21: "0x0f0a2d5e5",
  Ganzi: "0x04a1b2c3d",
  Isolde: "0x0150de7f6",
  Maelis: "0x7",
};
const avatar = (who: string) => playerAvatarUrl(ADDRESSES[who] ?? "0x1");

const DOCS = "https://docs.realms.party/frontier/expedition";
const VIDEO = "https://www.youtube.com/watch?v=ruin-run-day-12";
const MOONDEEP: Thing = { icon: "ruin", name: "Moondeep" };
const DUSKBITE: Thing = { icon: "realm", name: "Duskbite" };
const THORNWATCH: Thing = { icon: "camp", name: "Thornwatch", gone: true };

/** The owner's room (evidence/chat-owner-1028.png), with what the designs add: a reply, a place, a mention, a link. */
const ROOM: Line[] = [
  {
    id: "1",
    who: "BirthdayBoi",
    at: "19:40",
    parts: ["does exploring give something to me? or only mobs that i cant fight for labor?"],
  },
  {
    id: "2",
    who: "Nexonik",
    at: "19:42",
    replyTo: "1",
    parts: [
      "if you already deployed your armies for today, wait for the day to reset. exploring gives unit XP and a little labor; camps and rifts are where the labor is",
    ],
  },
  { id: "3", who: "BirthdayBoi", at: "19:47", parts: ["okok! so I will wait"] },
  {
    id: "4",
    who: "vorpalsword21",
    at: "20:48",
    parts: ["sent 1,200 knights at ", { thing: MOONDEEP }, ", 3,046 left at home"],
  },
  { id: "5", who: "vorpalsword21", at: "20:49", parts: ["yesterday's ", { thing: THORNWATCH }, " was empty"] },
  { id: "6", who: "djizus", at: "20:51", parts: ["exploration rewards are tied to your army size btw"] },
  { id: "7", who: "djizus", at: "20:53", parts: [{ link: DOCS }] },
  { id: "8", who: "Nexonik", at: "20:53", parts: ["make links clickable with CTRL + LMB pls"] },
  { id: "9", who: "djizus", at: "21:06", replyTo: "8", parts: ["yeah I need to overhaul the chat"] },
  {
    id: "10",
    who: "Isolde",
    at: "21:07",
    parts: [{ mention: ME }, " ", { thing: DUSKBITE }, " is next to mine, clear the rift together?"],
  },
  { id: "11", who: "vorpalsword21", at: "21:08", parts: ["my run today ", { link: VIDEO }] },
];
const WHISPER: Line = {
  id: "w",
  who: "Ganzi",
  at: "21:09",
  whisper: true,
  parts: ["gg on the spire, merge armies tomorrow?"],
};

/** The room each design shows where the player stands: A one room everywhere; B and C the place's own. */
const roomName = (design: Design, app: boolean) => (design === "a" || app ? "Global" : "Frontier");

const ChatDesign = ({ design, state, phone, app }: { design: Design; state: State; phone: boolean; app: boolean }) => {
  const skin = useSkin();
  const room = roomName(design, app);
  const lines = state === "empty" ? [] : design === "a" ? [...ROOM, WHISPER] : ROOM;
  const replying = state === "reply" ? ROOM.find((line) => line.id === "8") : undefined;
  const stream = (
    <Stream
      lines={lines}
      hovered={replying?.id}
      card={state === "object" ? "Isolde" : undefined}
      scrolled={state === "scrolled"}
    />
  );
  const composer = <Composer replying={replying} phone={phone} room={room} />;
  const online = (
    <skin.Chip icon="person" tone="good">
      4
    </skin.Chip>
  );
  if (design === "b")
    return (
      <skin.Panel
        title={
          <skin.Tabs
            tabs={[
              { key: "room", label: room },
              { key: "messages", label: "Messages", count: 1 },
            ]}
            value={state === "inbox" ? "messages" : "room"}
          />
        }
      >
        {state === "inbox" ? (
          <Inbox />
        ) : (
          <>
            {stream}
            {composer}
          </>
        )}
      </skin.Panel>
    );
  if (design === "c")
    return (
      <skin.Panel title={room} icon="chat" cue={online} row={!phone}>
        <Rounds phone={phone} app={app} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {stream}
          {composer}
        </div>
      </skin.Panel>
    );
  return (
    <skin.Panel title={room} icon="chat" cue={online}>
      {stream}
      {composer}
    </skin.Panel>
  );
};

/** B's Messages: each conversation, newest first, its last line and what is unread; a press opens it. */
const Inbox = () => {
  const skin = useSkin();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
      {CONVERSATIONS.map(({ who, last, at, unread }) => (
        <button key={who} type="button" className={cn("flex items-center gap-2 rounded-lg p-1.5 text-left")}>
          <img src={avatar(who)} alt="" className="size-9 shrink-0 rounded-full object-cover" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn(skin.strong, skin.ink)}>{who}</span>
            <span className={cn("truncate", skin.label, skin.muted)}>{last}</span>
          </span>
          {unread ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-hud-bad text-[11px] font-bold text-white">
              {unread}
            </span>
          ) : (
            <span className={cn(skin.label, skin.muted)}>{at}</span>
          )}
        </button>
      ))}
    </div>
  );
};
const CONVERSATIONS = [
  { who: "Ganzi", last: "gg on the spire, merge armies tomorrow?", at: "21:09", unread: 1 },
  { who: "Isolde", last: "deal, I take the camp", at: "Yesterday", unread: 0 },
  { who: "djizus", last: "thanks for the report", at: "26 Oct", unread: 0 },
];

/** C: every room and conversation as a round at the chat's side (a row on a phone): Global, the game's, each DM, New. */
const Rounds = ({ phone, app }: { phone: boolean; app: boolean }) => {
  const skin = useSkin();
  return (
    <div className={cn("flex shrink-0 gap-1.5 p-1.5", skin.line, phone ? "border-b" : "flex-col border-r")}>
      <Round icon="chat" label="Global" chosen />
      {!app && <Round icon="map" label="Frontier" />}
      <span className={cn("bg-current opacity-20", phone ? "w-px" : "h-px")} />
      <Round who="Ganzi" label="Ganzi" unread />
      <Round who="Isolde" label="Isolde" />
      <skin.IconButton icon="plus" label="New message" />
    </div>
  );
};

const Round = ({
  icon,
  who,
  label,
  chosen = false,
  unread = false,
}: {
  icon?: IconMeaning;
  who?: string;
  label: string;
  chosen?: boolean;
  unread?: boolean;
}) => {
  const skin = useSkin();
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={chosen}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border",
        skin.surface,
        chosen ? cn("border-2 border-current", skin.accent) : skin.line,
      )}
    >
      {who ? <img src={avatar(who)} alt="" className="size-full object-cover" /> : <Icon name={icon!} size={24} />}
      {unread && <span className="absolute right-0 top-0 size-2.5 rounded-full bg-hud-bad" />}
    </button>
  );
};

/**
 * The messages, newest at the foot, where the list opens and stays while the player reads there: a sender's run under
 * one name and time; a reply carries its quote above it; a message naming the player is lit; a whisper is the ally's
 * blue. `hovered` shows a message's Reply as a pointer over it does; `card` opens a sender's card as a press on their
 * name does; `scrolled` is the player reading up while two new messages came, which wait under a jump to them.
 */
const Stream = ({
  lines,
  hovered,
  card,
  scrolled,
}: {
  lines: Line[];
  hovered?: string;
  card?: string;
  scrolled: boolean;
}) => {
  const skin = useSkin();
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // A reversed column's scroll counts up from its foot: read 240 px up the list.
    if (scrolled && list.current) list.current.scrollTop = -240;
  }, [scrolled]);
  if (lines.length === 0)
    return <p className={cn("flex flex-1 items-center justify-center", skin.body, skin.muted)}>No messages yet</p>;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={list} className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto py-1">
        <ol className="flex flex-col">
          {lines.map((line, index) => {
            const before = lines[index - 1];
            const head = !before || before.who !== line.who || Boolean(line.replyTo) || before.whisper !== line.whisper;
            return (
              <Fragment key={line.id}>
                <Message line={line} head={head} hovered={hovered === line.id} />
                {card === line.who && <PlayerCard who={line.who} />}
              </Fragment>
            );
          })}
        </ol>
      </div>
      {scrolled && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <skin.Button>2 new messages</skin.Button>
        </span>
      )}
    </div>
  );
};

const Message = ({ line, head, hovered }: { line: Line; head: boolean; hovered: boolean }) => {
  const skin = useSkin();
  const quoted = line.replyTo ? ROOM.find((other) => other.id === line.replyTo) : undefined;
  const mentionsMe = line.parts.some((part) => typeof part === "object" && "mention" in part && part.mention === ME);
  return (
    <li
      className={cn(
        "group relative flex gap-2 px-2 py-0.5",
        head && "mt-1.5",
        mentionsMe && skin.chosen,
        line.whisper && "border-l-2 border-hud-ally",
        hovered && skin.hover,
      )}
    >
      <span className="w-8 shrink-0">
        {head && <img src={avatar(line.who)} alt="" className="size-8 rounded-full object-cover" />}
      </span>
      <div className="min-w-0 flex-1">
        {quoted && (
          <button
            type="button"
            className={cn("flex w-full min-w-0 items-center gap-1 text-left", skin.label, skin.muted)}
          >
            <span className={cn("h-2 w-3 shrink-0 rounded-tl border-l-2 border-t-2", skin.lineStrong)} />
            <span className={cn("shrink-0", skin.accent)}>{quoted.who}</span>
            <span className="truncate">{plain(quoted)}</span>
          </button>
        )}
        {head && (
          <div className="flex items-baseline gap-2">
            <button type="button" className={cn(skin.strong, line.whisper ? "text-hud-ally" : skin.accent)}>
              {line.whisper ? `${line.who} to you` : line.who}
            </button>
            <span className={cn(skin.label, skin.muted, "tabular-nums opacity-80")}>{line.at}</span>
          </div>
        )}
        <p className={cn("break-words", skin.body, line.whisper ? "text-hud-ally" : skin.ink)}>
          {line.parts.map((part, index) => (
            <Piece key={index} part={part} />
          ))}
        </p>
      </div>
      <span className={cn("absolute right-1 top-0", hovered ? "flex" : "hidden group-hover:flex")}>
        <skin.Button>Reply</skin.Button>
      </span>
    </li>
  );
};

const plain = (line: Line) =>
  line.parts
    .map((part) =>
      typeof part === "string"
        ? part
        : "link" in part
          ? part.link
          : "thing" in part
            ? part.thing.name
            : `@${part.mention}`,
    )
    .join("");

/** A link names its site; one off Realms' own sites carries the leaving mark, and asks first (LeavingRealms). */
const Piece = ({ part }: { part: Part }) => {
  const skin = useSkin();
  if (typeof part === "string") return <>{part}</>;
  if ("mention" in part) return <span className={part.mention === ME ? skin.gold : skin.accent}>@{part.mention}</span>;
  if ("thing" in part)
    return (
      <span className={cn("inline-flex align-middle", part.thing.gone && "line-through opacity-50")}>
        <skin.Chip icon={part.thing.icon}>{part.thing.name}</skin.Chip>
      </span>
    );
  const url = new URL(part.link);
  const own = url.hostname.endsWith("realms.party");
  return (
    <a
      href={part.link}
      onClick={(event) => event.preventDefault()}
      className={cn(skin.accent, "underline underline-offset-2")}
    >
      {url.hostname.replace(/^www\./, "")}
      {url.pathname.length > 1 && url.pathname}
      {!own && <Icon name="external-link" size={14} className="ml-0.5 inline align-[-2px]" />}
    </a>
  );
};

/** A sender's card, from their name: their realm to find on the map, a message to them, and Mute. */
const PlayerCard = ({ who }: { who: string }) => {
  const skin = useSkin();
  return (
    <li className={cn("mx-2 my-1 flex items-center gap-2 rounded-lg border p-2", skin.lineStrong, skin.surface)}>
      <img src={avatar(who)} alt="" className="size-10 rounded-full object-cover" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className={cn(skin.strong, skin.ink)}>{who}</span>
        <skin.Chip icon="realm">Hollowmere</skin.Chip>
      </div>
      <skin.Button>Message</skin.Button>
      <skin.IconButton icon="mute" label="Mute" />
    </li>
  );
};

/** The field, the selected place to drop in, and Send; replying, the message answered stands over it with its way out. */
const Composer = ({ replying, phone, room }: { replying?: Line; phone: boolean; room: string }) => {
  const skin = useSkin();
  return (
    <div className={cn("flex shrink-0 flex-col gap-1 border-t p-1.5", skin.line)}>
      {replying && (
        <div className={cn("flex min-w-0 items-center gap-1.5 px-1", skin.label, skin.muted)}>
          <span className={cn("shrink-0", skin.accent)}>{replying.who}</span>
          <span className="min-w-0 flex-1 truncate">{plain(replying)}</span>
          <skin.IconButton icon="close" label="Cancel the reply" />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {!phone && skin === HUD && <skin.IconButton icon="location" label="Share the selected place" />}
        <span className="min-w-0 flex-1">
          <skin.Field value={replying ? "on it, next batch tonight" : ""} placeholder={`Message ${room}`} />
        </span>
        <skin.Button primary={Boolean(replying)}>Send</skin.Button>
      </div>
    </div>
  );
};

/** A link off Realms' own sites, asked before it opens: where it goes, whole, and the two ways on. */
const LeavingRealms = ({ url }: { url: string }) => (
  // The kit's fit window: a bottom sheet across a phone, a box as wide as its words from the desktop width up.
  <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center lg:p-4">
    <div className="max-w-full">
      <HudWindow title="Leaving Realms" icon="external-link" size="fit" onClose={noop}>
        <Address url={url} />
        <HudWindowFoot>
          <HudButton kind="secondary">Cancel</HudButton>
          <HudButton kind="primary">Open</HudButton>
        </HudWindowFoot>
      </HudWindow>
    </div>
  </div>
);

/** A link's address, whole, its site's name standing out. */
const Address = ({ url }: { url: string }) => {
  const { hostname } = new URL(url);
  return (
    <p className="break-all opacity-80">
      https://<b>{hostname}</b>
      {url.slice(`https://${hostname}`.length)}
    </p>
  );
};

/**
 * The chat in the app, where a player stands between games: on a desktop, a pane at the page's foot right over Play;
 * on a phone, the page Chat opens from the tab bar.
 */
const InTheApp = ({ chat, phone, link }: { chat: ReactNode; phone: boolean; link: boolean }) => {
  const leaving = link && (
    <AppDialog
      title="Leaving Realms"
      onClose={noop}
      actions={
        <>
          <AppButton kind="secondary">Cancel</AppButton>
          <AppButton kind="primary">Open</AppButton>
        </>
      }
    >
      <Address url={VIDEO} />
    </AppDialog>
  );
  if (phone)
    return (
      <div data-lab="chat-designs" data-surface="shell" className="fixed inset-0 flex flex-col bg-kit-ground font-body">
        <div className="flex min-h-0 flex-1 flex-col p-2">{chat}</div>
        <AppTabsWithChat />
        {leaving}
      </div>
    );
  return (
    <div data-lab="chat-designs">
      <PageFrame title="Play">
        <AppPanel title="Frontier" icon="spire">
          <AppButton kind="primary" size="lg">
            Resume
          </AppButton>
        </AppPanel>
      </PageFrame>
      <div data-surface="shell" className="fixed bottom-4 right-4 z-40 flex h-[520px] w-[360px] flex-col">
        {chat}
      </div>
      {leaving}
    </div>
  );
};

/**
 * The app's tab bar as this pick would have it: Chat a place between What's new and Market, lit while open. Drawn
 * after the bar's own look (shell/frame/tabs.tsx); the bar itself does not change here.
 */
const AppTabsWithChat = () => (
  <nav className="flex h-16 shrink-0 border-t border-kit-line bg-kit-ground px-2.5">
    {(
      [
        ["play", "Play"],
        ["leaderboard", "Season"],
        ["chronicles", "What's new"],
        ["chat", "Chat"],
        ["trade", "Market"],
        ["person", "You"],
      ] as const
    ).map(([icon, word]) => (
      <span
        key={word}
        className={cn(
          "relative flex min-h-12 flex-auto flex-col items-center justify-center gap-[3px] whitespace-nowrap font-ui text-sm font-semibold",
          word === "Chat" ? "text-kit-peach" : "text-kit-muted",
        )}
      >
        <Icon name={icon} size={28} />
        {word}
      </span>
    ))}
  </nav>
);
