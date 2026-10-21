import type { IconMeaning } from "../../ui/design-system/icon-meaning";

// The patch notes' data shape, apart from the views that draw it: the generated notes and the docs site import it, so
// it imports by relative path only.

/** A release's sections in the order it lists them: what touches every mode, then each mode. */
export const PATCH_MODES = ["all", "frontier", "blitz", "eternum"] as const;
export type PatchMode = (typeof PATCH_MODES)[number];

/** The kinds of change a section groups, in their order: New, Balance, Fixes. */
export const PATCH_KINDS = ["new", "balance", "fix"] as const;
type PatchKind = (typeof PATCH_KINDS)[number];

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
