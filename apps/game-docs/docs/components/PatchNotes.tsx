import { formatContentDay } from "@bibliothecadao/types";

import { patchNotes } from "../../../game/src/shell/generated/patch-notes";
import { iconUrl } from "../../../game/src/ui/design-system/icon-meaning";
import { colors, fonts } from "./styles";

/** Each section by its heading in the release files (apps/game/content/patch-notes), in their order. */
const SECTIONS = [
  ["all", "All modes"],
  ["frontier", "Frontier"],
  ["blitz", "Blitz"],
  ["eternum", "Eternum"],
] as const;
const KINDS = [
  ["new", "New"],
  ["balance", "Balance"],
  ["fix", "Fixes"],
] as const;

type Note = (typeof patchNotes)[number];
type Change = Note["modes"][(typeof SECTIONS)[number][0]][number];

/**
 * The changelog: every release's patch notes, newest first, read from the same files as the game's What's new. Each
 * release shows the sections it changed, each change with its icon, its name, its line and a moved number's old and new.
 */
export const PatchNotes = () => (
  <div style={{ fontFamily: fonts.body }}>
    {patchNotes.map((note) => (
      <Release key={note.date} note={note} />
    ))}
  </div>
);

const Release = ({ note }: { note: Note }) => (
  <section id={note.date} style={{ marginBottom: "2.5rem" }}>
    <h2 style={{ fontFamily: fonts.heading, color: colors.text.light, marginBottom: "0.25rem" }}>{note.title}</h2>
    <p style={{ color: colors.primary, margin: 0 }}>{formatContentDay(note.date)}</p>
    <p style={{ color: colors.text.light }}>{note.summary}</p>
    {SECTIONS.filter(([mode]) => note.modes[mode].length > 0).map(([mode, name]) => (
      <div key={mode}>
        <h3 style={{ fontFamily: fonts.heading, color: colors.primary }}>{name}</h3>
        {KINDS.map(([kind, kindName]) => {
          const changes = note.modes[mode].filter((change) => change.kind === kind);
          return changes.length === 0 ? null : (
            <div key={kind}>
              <h4 style={{ color: colors.text.muted, margin: "0.75rem 0 0.25rem" }}>{kindName}</h4>
              {changes.map((change) => (
                <ChangeRow key={change.title} change={change} />
              ))}
            </div>
          );
        })}
      </div>
    ))}
  </section>
);

const ChangeRow = ({ change }: { change: Change }) => (
  <div
    style={{
      display: "flex",
      gap: "0.75rem",
      alignItems: "flex-start",
      padding: "0.5rem 0",
      borderBottom: `1px solid ${colors.border}`,
    }}
  >
    <img src={iconUrl(change.icon)} alt="" width={32} height={32} style={{ flex: "none" }} />
    <div style={{ flex: 1 }}>
      <strong style={{ color: colors.text.light }}>{change.title}</strong>
      <div style={{ color: colors.text.muted }}>{change.line}</div>
    </div>
    {"from" in change && (
      <span style={{ whiteSpace: "nowrap", color: colors.text.light }}>
        <s style={{ color: colors.text.muted }}>{change.from}</s> → <b>{change.to}</b>
      </span>
    )}
  </div>
);
