import { useHudMode } from "@/hooks/use-hud-mode";
import { playerAvatarUrl } from "@/hooks/use-player-profile";
import { useLayout } from "@/shell/frame/layout";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudField,
  HudIconButton,
  HudPanel,
  HudRow,
  HudTabs,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { PlaceNav } from "@/ui/features/frontier/hud/place-nav";
import { Fragment, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Dev only: the chat overhaul's designs at /lab/kit/chat-designs, drawn from the kit for the owner's pick (stills on
 * evidence/picks/chat). `?design=a` one room, whispers in it; `b` the room and Messages; `c` a column of rooms. `&state=`
 * busy, empty, reply, link (the leaving-Realms window), object (a player's card from their name) or, for b, inbox (its
 * Messages). Desktop draws the rail's chat pane, a phone the chat page over the place bar. Static: nothing here sends
 * or reads.
 */
export const ChatDesignsLab = () => {
  useHudMode("frontier");
  const [params] = useSearchParams();
  const design = (params.get("design") ?? "a") as Design;
  const state = (params.get("state") ?? "busy") as State;
  const desktop = useLayout() === "desktop";
  const chat = <ChatDesign design={design} state={state} phone={!desktop} />;
  return (
    <div
      data-lab="chat-designs"
      className="ui fixed inset-0 bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]"
    >
      {desktop ? (
        <div className="absolute bottom-4 right-3 flex h-hud-chat-pane w-hud-column flex-col">{chat}</div>
      ) : (
        <div className="absolute inset-0 flex flex-col gap-1.5 p-2">
          <div className="flex min-h-0 flex-1 flex-col">{chat}</div>
          <PlaceNav place="chat" onRealm={false} onGo={noop} researchDot events={2} unread={0} />
        </div>
      )}
      {state === "link" && <LeavingRealms url={VIDEO} />}
    </div>
  );
};

type Design = "a" | "b" | "c";
type State = "busy" | "empty" | "reply" | "link" | "object" | "inbox";

const noop = () => undefined;
const ME = "Maelis";

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

const ChatDesign = ({ design, state, phone }: { design: Design; state: State; phone: boolean }) => {
  const lines = state === "empty" ? [] : design === "a" ? [...ROOM, WHISPER] : ROOM;
  const replying = state === "reply" ? ROOM.find((line) => line.id === "8") : undefined;
  const stream = <Stream lines={lines} hovered={replying?.id} card={state === "object" ? "Isolde" : undefined} />;
  const composer = <Composer replying={replying} phone={phone} />;
  if (design === "b")
    return (
      <RoomAndMessages
        body={
          state === "inbox" ? (
            <Inbox />
          ) : (
            <>
              {stream}
              {composer}
            </>
          )
        }
        inbox={state === "inbox"}
      />
    );
  if (design === "c") return <RoomsColumn stream={stream} composer={composer} phone={phone} />;
  return (
    <HudPanel
      title="Frontier"
      icon="chat"
      cue={<HudChip tone="good">4 online</HudChip>}
      collapsible={false}
      className="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      {stream}
      {composer}
    </HudPanel>
  );
};

/** B: the game's room, and Messages beside it, a list of conversations with what is unread. */
const RoomAndMessages = ({ body, inbox }: { body: ReactNode; inbox: boolean }) => (
  <HudPanel
    title={
      <HudTabs
        size="sm"
        tabs={[
          { key: "room", label: "Frontier" },
          { key: "messages", label: "Messages", count: 1 },
        ]}
        value={inbox ? "messages" : "room"}
        onChange={noop}
      />
    }
    collapsible={false}
    className="flex min-h-0 flex-1 flex-col"
    bodyClassName="flex min-h-0 flex-1 flex-col p-0"
  >
    {body}
  </HudPanel>
);

/** B's Messages: each conversation, newest first, its last line and what is unread; a press opens it. */
const Inbox = () => (
  <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
    {CONVERSATIONS.map(({ who, last, at, unread }) => (
      <HudRow
        key={who}
        lead={<img src={avatar(who)} alt="" className="size-9 rounded-full object-cover" />}
        title={who}
        detail={last}
        trail={
          unread ? <HudChip tone="bad">{unread}</HudChip> : <span className="text-hud-label text-hud-cue">{at}</span>
        }
        onClick={noop}
      />
    ))}
  </div>
);
const CONVERSATIONS = [
  { who: "Ganzi", last: "gg on the spire, merge armies tomorrow?", at: "21:09", unread: 1 },
  { who: "Isolde", last: "deal, I take the camp", at: "Yesterday", unread: 0 },
  { who: "djizus", last: "thanks for the report", at: "26 Oct", unread: 0 },
];

/** C: every room and conversation as a round at the chat's side (a row on a phone): Global, the game, each DM, New. */
const RoomsColumn = ({ stream, composer, phone }: { stream: ReactNode; composer: ReactNode; phone: boolean }) => {
  const rooms = (
    <div
      className={cn(
        "flex shrink-0 gap-1.5 p-1.5",
        phone ? "border-b border-hud-line" : "flex-col border-r border-hud-line",
      )}
    >
      <Round icon="chat" label="Global" chosen />
      <Round icon="map" label="Frontier" />
      <span className={cn("bg-hud-line", phone ? "w-px" : "h-px")} />
      <Round who="Ganzi" label="Ganzi" unread />
      <Round who="Isolde" label="Isolde" />
      <HudIconButton icon="plus" label="New message" kind="quiet" />
    </div>
  );
  return (
    <HudPanel
      title="Global"
      icon="chat"
      cue={<HudChip tone="good">4 online</HudChip>}
      collapsible={false}
      className="flex min-h-0 flex-1 flex-col"
      bodyClassName={cn("flex min-h-0 flex-1 p-0", phone ? "flex-col" : "flex-row")}
    >
      {rooms}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {stream}
        {composer}
      </div>
    </HudPanel>
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
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={chosen}
    className={cn(
      "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-hud-surface",
      chosen ? "border-2 border-hud-accent" : "border-hud-line",
    )}
  >
    {who ? <img src={avatar(who)} alt="" className="size-full object-cover" /> : <Icon name={icon!} size={24} />}
    {unread && <span className="absolute right-0 top-0 size-2.5 rounded-full border border-hud-dark bg-hud-bad" />}
  </button>
);

/**
 * The messages, newest at the foot: a sender's run under one name and time; a reply carries its quote above it; a
 * message naming the player is lit; a whisper is the ally's blue. `hovered` shows a message's Reply as a pointer over
 * it does; `card` opens a sender's card as a press on their name does.
 */
const Stream = ({ lines, hovered, card }: { lines: Line[]; hovered?: string; card?: string }) => {
  if (lines.length === 0)
    return <p className="flex flex-1 items-center justify-center text-hud-body text-hud-muted">No messages yet</p>;
  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto py-1">
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
  );
};

const Message = ({ line, head, hovered }: { line: Line; head: boolean; hovered: boolean }) => {
  const quoted = line.replyTo ? ROOM.find((other) => other.id === line.replyTo) : undefined;
  const mentionsMe = line.parts.some((part) => typeof part === "object" && "mention" in part && part.mention === ME);
  return (
    <li
      className={cn(
        "group relative flex gap-2 px-2 py-0.5",
        head && "mt-1.5",
        mentionsMe && "bg-hud-chosen",
        line.whisper && "border-l-2 border-hud-ally",
        hovered && "bg-hud-hover",
      )}
    >
      <span className="w-8 shrink-0">
        {head && <img src={avatar(line.who)} alt="" className="size-8 rounded-full object-cover" />}
      </span>
      <div className="min-w-0 flex-1">
        {quoted && (
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-1 text-left text-hud-label text-hud-muted"
          >
            <span className="h-2 w-3 shrink-0 rounded-tl border-l-2 border-t-2 border-hud-line-strong" />
            <span className="shrink-0 text-hud-accent">{quoted.who}</span>
            <span className="truncate">{plain(quoted)}</span>
          </button>
        )}
        {head && (
          <div className="flex items-baseline gap-2">
            <button type="button" className={cn("text-hud-strong", line.whisper ? "text-hud-ally" : "text-hud-accent")}>
              {line.whisper ? `${line.who} to you` : line.who}
            </button>
            <span className="text-hud-label text-hud-cue tabular-nums">{line.at}</span>
          </div>
        )}
        <p className={cn("break-words text-hud-body", line.whisper ? "text-hud-ally" : "text-hud-ink")}>
          {line.parts.map((part, index) => (
            <Piece key={index} part={part} />
          ))}
        </p>
      </div>
      <span className={cn("absolute right-1 top-0", hovered ? "flex" : "hidden group-hover:flex")}>
        <HudButton kind="secondary" size="sm">
          Reply
        </HudButton>
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
  if (typeof part === "string") return <>{part}</>;
  if ("mention" in part)
    return <span className={part.mention === ME ? "text-hud-gold" : "text-hud-accent"}>@{part.mention}</span>;
  if ("thing" in part)
    return (
      <span className={cn("inline-flex align-middle", part.thing.gone && "line-through opacity-50")}>
        <HudChip icons={[part.thing.icon]} onPress={part.thing.gone ? undefined : noop} disabled={part.thing.gone}>
          {part.thing.name}
        </HudChip>
      </span>
    );
  const url = new URL(part.link);
  const own = url.hostname.endsWith("realms.party");
  return (
    <a
      href={part.link}
      onClick={(event) => event.preventDefault()}
      className="text-hud-accent underline underline-offset-2"
    >
      {url.hostname.replace(/^www\./, "")}
      {url.pathname.length > 1 && url.pathname}
      {!own && <Icon name="external-link" size={14} className="ml-0.5 inline align-[-2px]" />}
    </a>
  );
};

/** A sender's card, from their name: their realm to find on the map, a message to them, and Mute. */
const PlayerCard = ({ who }: { who: string }) => (
  <li className="mx-2 my-1 flex items-center gap-2 rounded-hud-control border border-hud-line-strong bg-hud-surface p-2">
    <img src={avatar(who)} alt="" className="size-10 rounded-full object-cover" />
    <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
      <span className="text-hud-strong text-hud-ink">{who}</span>
      <HudChip icons={["realm"]} onPress={noop}>
        Hollowmere
      </HudChip>
    </div>
    <HudButton kind="secondary" size="sm">
      Message
    </HudButton>
    <HudIconButton icon="mute" label="Mute" kind="quiet" size="sm" />
  </li>
);

/** The field, the selected place to drop in, and Send; replying, the message answered stands over it with its way out. */
const Composer = ({ replying, phone }: { replying?: Line; phone: boolean }) => (
  <div className="flex shrink-0 flex-col gap-1 border-t border-hud-line p-1.5">
    {replying && (
      <div className="flex min-w-0 items-center gap-1.5 px-1 text-hud-label text-hud-muted">
        <span className="shrink-0 text-hud-accent">{replying.who}</span>
        <span className="min-w-0 flex-1 truncate">{plain(replying)}</span>
        <HudIconButton icon="close" label="Cancel the reply" kind="quiet" size="sm" />
      </div>
    )}
    <div className="flex items-center gap-1.5">
      {!phone && <HudIconButton icon="location" label="Share the selected place" kind="quiet" />}
      <span className="min-w-0 flex-1">
        <HudField
          value={replying ? "on it, next batch tonight" : ""}
          onChange={noop}
          placeholder="Message Frontier"
          aria-label="Message"
        />
      </span>
      <HudButton kind={replying ? "primary" : "secondary"}>Send</HudButton>
    </div>
  </div>
);

/** A link off Realms' own sites, asked before it opens: where it goes, whole, and the two ways on. */
const LeavingRealms = ({ url }: { url: string }) => {
  const { hostname } = new URL(url);
  return (
    // The kit's fit window: a bottom sheet across a phone, a box as wide as its words from the desktop width up.
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center lg:p-4">
      <div className="max-w-full">
        <HudWindow title="Leaving Realms" icon="external-link" size="fit" onClose={noop}>
          <p className="break-all text-hud-body text-hud-muted">
            https://<span className="text-hud-strong text-hud-ink">{hostname}</span>
            {url.slice(`https://${hostname}`.length)}
          </p>
          <HudWindowFoot>
            <HudButton kind="secondary">Cancel</HudButton>
            <HudButton kind="primary">Open</HudButton>
          </HudWindowFoot>
        </HudWindow>
      </div>
    </div>
  );
};
