import { Icon } from "@/ui/design-system/icon";
import { iconDefinition, iconMeanings } from "@/ui/design-system/icon-meaning";
import { HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { Link } from "react-router-dom";

import { Element } from "./sheet-element";

/** The Facets UI glyphs: the semantic map's Controls family, read from it so the sheet shows every one it holds. */
const GLYPHS = iconMeanings.filter((name) => iconDefinition(name).family === "Controls");

/**
 * The owner's round 5: "We do need to add the UI icons in there as well". The Facets UI glyphs as their own family of
 * the sheet: each at the size a regular button draws it, named, then the two sizes the sheet's buttons use.
 */
export const GlyphsSection = () => (
  <Element
    name="UI glyphs"
    wide
    rule="The Facets UI glyphs, one family: a button's painting at 20 px, a small button's at 16 px, never another size on the HUD. Each named as the game names it."
    sheet={
      <div data-glyphs className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <HudIconButton icon="close" label="Close" />
          <HudIconButton icon="close" label="Close" size="sm" />
          <HudIconButton icon="settings" label="Settings" kind="quiet" />
          <HudIconButton icon="settings" label="Settings" kind="quiet" size="sm" />
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-1">
          {GLYPHS.map((name) => (
            <li key={name} data-glyph={name} className="flex min-w-0 items-center gap-2 px-2 py-1">
              <Icon name={name} size={20} />
              <span className="truncate text-hud-label text-hud-muted">{iconDefinition(name).label}</span>
            </li>
          ))}
        </ul>
      </div>
    }
    today={
      <span className="text-sm text-white/70">
        The {GLYPHS.length} glyphs live in the Facets catalog (<Link to="/lab/kit/icons">Icons</Link>, family Controls)
        at 24, 32 and 64 px, beside the resources, troops and structures; the sheet had no family of them.
      </span>
    }
  />
);
