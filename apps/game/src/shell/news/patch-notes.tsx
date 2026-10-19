import { formatContentDay } from "@bibliothecadao/types";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppPanel, AppRow } from "@/ui/design-system/kit/app-elements";
import type { Painting } from "@/ui/design-system/kit/paintings";
import { NEWS_WORDS } from "@/ui/design-system/kit/words";

import { ageOf } from "../play/ages";

type PatchKind = keyof typeof NEWS_WORDS.kinds;

/** A release's sections in the order it lists them: what touches every mode, then each mode. */
const PATCH_MODES = ["all", "frontier", "blitz", "eternum"] as const;
type PatchMode = (typeof PATCH_MODES)[number];

/** A section's name and painting: All modes on the app's landscape, a mode on its age's. */
export const patchSection = (mode: PatchMode): { name: string; painting: Painting } =>
  mode === "all" ? { name: NEWS_WORDS.allModes, painting: "brooding-plains" } : ageOf(mode);

/**
 * One change as a player reads it: its picture (the troop, resource or action it touches), its name in a few words, the
 * line that says it whole, and for a number that moved, where it was and where it is.
 */
export type PatchChange = {
  kind: PatchKind;
  icon: IconMeaning;
  title: string;
  line: string;
  from?: string;
  to?: string;
};

/** A release's notes: its name and day, its one-line summary, and each mode's changes. */
export type PatchNote = {
  date: string;
  title: string;
  summary: string;
  modes: Record<PatchMode, readonly PatchChange[]>;
};

const KINDS: readonly PatchKind[] = ["new", "balance", "fix"];

/** The sections a release changed, in their order. */
export const changedSections = (note: PatchNote): PatchMode[] =>
  PATCH_MODES.filter((mode) => note.modes[mode].length > 0);

/** The release's name, its day and its summary: what the patch is about before its lines. */
export const PatchHead = ({ note }: { note: PatchNote }) => (
  <header className="flex flex-col gap-1">
    <span className="text-app-label text-app-muted">{formatContentDay(note.date)}</span>
    <h3 className="text-app-title text-app-ink">{note.title}</h3>
    <p className="text-app-body text-app-ink">{note.summary}</p>
  </header>
);

/** A section's changes, grouped New, Balance, Fixes. */
export const PatchChanges = ({ changes }: { changes: readonly PatchChange[] }) => (
  <>
    {KINDS.map((kind) => {
      const ofKind = changes.filter((change) => change.kind === kind);
      return ofKind.length === 0 ? null : (
        <section key={kind} aria-label={NEWS_WORDS.kinds[kind]}>
          <h4 className="px-5 pb-1 pt-3 text-app-label text-app-muted">{NEWS_WORDS.kinds[kind]}</h4>
          {ofKind.map((change) => (
            <AppRow
              key={change.title}
              lead={<Icon name={change.icon} size={32} />}
              title={change.title}
              detail={change.line}
              trail={
                change.from !== undefined && change.to !== undefined ? (
                  <Move from={change.from} to={change.to} />
                ) : undefined
              }
            />
          ))}
        </section>
      );
    })}
  </>
);

/** A number that moved: the old one struck, then the new. */
const Move = ({ from, to }: { from: string; to: string }) => (
  <span className="flex items-center gap-1 whitespace-nowrap">
    <s className="text-app-muted">{from}</s>
    <Icon name="arrow-right" size={16} />
    <b className="text-app-ink">{to}</b>
  </span>
);

/** One section of a release under its painted head: its name, then its changes. */
export const PatchSection = ({ note, mode }: { note: PatchNote; mode: PatchMode }) => {
  const section = patchSection(mode);
  return (
    <AppPanel title={section.name} painting={section.painting} flush>
      <PatchChanges changes={note.modes[mode]} />
    </AppPanel>
  );
};

/** Every release, newest first, each a row that shows it; the one on show is lit. */
export const ReleaseRows = ({
  notes,
  shown,
  onShow,
}: {
  notes: readonly PatchNote[];
  shown: number;
  onShow: (index: number) => void;
}) => (
  <>
    {notes.map((note, index) => (
      <AppRow
        key={note.date}
        own={index === shown}
        title={note.title}
        detail={formatContentDay(note.date)}
        onClick={() => onShow(index)}
      />
    ))}
  </>
);
