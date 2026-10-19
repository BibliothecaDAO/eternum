import { formatContentDay } from "@bibliothecadao/types";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppRow } from "@/ui/design-system/kit/app-elements";
import { NEWS_WORDS } from "@/ui/design-system/kit/words";

import type { PlayMode } from "../play/play-board";

type PatchKind = keyof typeof NEWS_WORDS.kinds;

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
  modes: Record<PlayMode, readonly PatchChange[]>;
};

const KINDS: readonly PatchKind[] = ["new", "balance", "fix"];

/** The release's name, its day and its summary: what the patch is about before its lines. */
export const PatchHead = ({ note }: { note: PatchNote }) => (
  <header className="flex flex-col gap-1">
    <span className="text-app-label text-app-muted">{formatContentDay(note.date)}</span>
    <h3 className="text-app-title text-app-ink">{note.title}</h3>
    <p className="text-app-body text-app-ink">{note.summary}</p>
  </header>
);

/** A mode's changes, grouped New, Balance, Fixes; a mode the release left as it was says so. */
export const PatchChanges = ({ changes }: { changes: readonly PatchChange[] }) => {
  if (changes.length === 0) return <p className="px-5 py-3 text-app-body text-app-muted">{NEWS_WORDS.unchanged}</p>;
  return (
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
};

/** A number that moved: the old one struck, then the new. */
const Move = ({ from, to }: { from: string; to: string }) => (
  <span className="flex items-center gap-1 whitespace-nowrap">
    <s className="text-app-muted">{from}</s>
    <Icon name="arrow-right" size={16} />
    <b className="text-app-ink">{to}</b>
  </span>
);
