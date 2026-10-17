import type { CSSProperties, ReactNode } from "react";

import { paintingSources } from "@/ui/design-system/kit/paintings";
import {
  FONTS,
  GUTTERS,
  HUD_COLORS,
  HUD_FINISH,
  RADII,
  SCREENS,
  SHELL_COLORS,
  SHELL_FINISH,
  SPACING,
  TYPE,
  WIDTHS,
} from "@/tokens";

/**
 * Dev only, at /lab/kit/tokens: every value in src/tokens.ts drawn from the token file itself, so the page cannot go
 * stale. Values are applied as inline styles because Tailwind only generates the class names it finds written out; the
 * shell's and the HUD's palettes and finishes stand side by side.
 */
export const TokensLab = () => (
  <main className="min-h-dvh bg-kit-ground px-4 py-6 font-body text-kit-cream">
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <PalettesSection />
      <FacesSection />
      <TypeSection />
      <SpacingSection />
      <RadiiSection />
      <TitleShadowsSection />
      <FinishSection />
      <WidthsSection />
    </div>
  </main>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section data-token-section={title} className="flex flex-col gap-3">
    <h2 className="border-b border-kit-line pb-2 text-lead text-kit-muted">{title}</h2>
    {children}
  </section>
);

/** A token's name and value, as the lab writes every one. */
const Label = ({ name, value }: { name: string; value: string }) => (
  <span className="text-caption">
    <b>{name}</b> <span className="text-kit-muted">{value}</span>
  </span>
);

const SURFACES = [
  { surface: "shell", colors: SHELL_COLORS, finish: SHELL_FINISH },
  { surface: "hud", colors: HUD_COLORS, finish: HUD_FINISH },
] as const;

const PalettesSection = () => (
  <Section title="Palettes">
    {SURFACES.map(({ surface, colors }) => (
      <div key={surface} data-palette={surface} className="flex flex-col gap-2">
        <h3 className="text-body font-bold">{surface === "shell" ? "Shell (SHELL_COLORS)" : "HUD (HUD_COLORS)"}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(colors).map(([name, value]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <span className="h-14 rounded-control border border-kit-line" style={{ background: value }} />
              <Label name={name} value={value} />
            </div>
          ))}
        </div>
      </div>
    ))}
  </Section>
);

const FacesSection = () => (
  <Section title="Faces">
    {Object.entries(FONTS).map(([name, value]) => (
      <div key={name} className="flex flex-col gap-1">
        <span className="text-heading" style={{ fontFamily: value }}>
          The realms remember
        </span>
        <Label name={`font-${name}`} value={value} />
      </div>
    ))}
  </Section>
);

/** A type step as CSS: its size, and its line-height when the step carries one. */
const typeStyle = (step: string | readonly string[]): CSSProperties =>
  typeof step === "string" ? { fontSize: step } : { fontSize: step[0], lineHeight: step[1] };

const TypeSection = () => (
  <Section title="Type scale">
    {Object.entries(TYPE).map(([name, step]) => (
      <div key={name} data-type-step={name} className="flex flex-col gap-1 border-b border-kit-line/50 pb-3">
        <Label name={`text-${name}`} value={typeof step === "string" ? step : step.join(" / ")} />
        <span className="font-display" style={typeStyle(step)}>
          Season of the Spires
        </span>
        <span className="font-body" style={typeStyle(step)}>
          Season of the Spires
        </span>
      </div>
    ))}
  </Section>
);

const SpacingSection = () => (
  <Section title="Spacing">
    <div className="flex flex-col gap-1.5">
      {Object.entries(SPACING).map(([name, value]) => (
        <div key={name} data-spacing-step={name} className="flex items-center gap-3">
          <span className="w-40 shrink-0">
            <Label name={`p-${name}`} value={value} />
          </span>
          <span className="h-3 bg-kit-peach/60" style={{ width: value }} />
        </div>
      ))}
    </div>
  </Section>
);

const RadiiSection = () => (
  <Section title="Radii">
    <div className="flex flex-wrap gap-4">
      {Object.entries(RADII).map(([name, value]) => (
        <div key={name} className="flex flex-col items-start gap-1.5">
          <span className="size-20 border-2 border-kit-line2 bg-kit-plate" style={{ borderRadius: value }} />
          <Label name={`rounded-${name}`} value={value} />
        </div>
      ))}
    </div>
  </Section>
);

/** Each finish group by what it styles, and the class or variable a component reaches it by. */
const FINISH_GROUPS: Record<keyof typeof HUD_FINISH, string> = {
  textShadow: "Text shadows: text-shadow-<name>",
  shadow: "Shadows: shadow-<name>",
  gradient: "Gradients: bg-<name>",
  primary: "Primary button: .frontier-primary",
  overlay: "Overlay surface: --overlay-surface-*",
  sheet: "Sheet: .frontier-sheet, .frontier-handle",
  card: "Card: .frontier-card",
  chip: "Chip: .frontier-chip",
  plate: "Plate: .plate, .plate-title (desktop)",
  painted: "Painted card: .painted (desktop)",
  leather: "Leather: .leather (desktop)",
  grain: "Grain: .grain, .painted (desktop)",
  ornament: "Ornament art",
};

const FinishSection = () => (
  <Section title="Finish">
    {(Object.keys(FINISH_GROUPS) as (keyof typeof HUD_FINISH)[]).map((group) => (
      <div key={group} data-finish-group={group} className="flex flex-col gap-2">
        <h3 className="text-body font-bold">{FINISH_GROUPS[group]}</h3>
        {Object.keys(HUD_FINISH[group]).map((name) => (
          <div key={name} className="grid grid-cols-1 gap-3 border-b border-kit-line/50 pb-3 lg:grid-cols-2">
            {SURFACES.map(({ surface, finish }) => {
              const value = (finish[group] as Record<string, string>)[name];
              return (
                <div key={surface} className="flex items-center gap-3">
                  <FinishSample group={group} name={name} value={value} />
                  <Label name={`${surface} ${group}.${name}`} value={value} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    ))}
  </Section>
);

/** A finish value drawn as what it is: a ground, a shadow on a plate, a title's shadow, a corner, a number. */
const FinishSample = ({ group, name, value }: { group: string; name: string; value: string }) => {
  const box = "size-16 shrink-0 rounded-control border border-kit-line";
  if (group === "textShadow")
    return (
      <span className="w-16 shrink-0 font-display text-title" style={{ textShadow: value }}>
        Aa
      </span>
    );
  if (value.startsWith("url(") || value.includes("gradient("))
    return <span className={box} style={{ backgroundImage: value, backgroundSize: "cover" }} />;
  if (/shadow|glow|keyline/.test(`${group}-${name}`) || group === "shadow")
    return <span className={`${box} bg-kit-plate`} style={{ boxShadow: value }} />;
  if (name.startsWith("radius")) return <span className={`${box} bg-kit-plate`} style={{ borderRadius: value }} />;
  if (/^(#|rgb)/.test(value)) return <span className={box} style={{ background: value }} />;
  return <span className={`${box} flex items-center justify-center text-caption`}>{value}</span>;
};

const WidthsSection = () => (
  <Section title="Widths, gutters, screens">
    {Object.entries(WIDTHS).map(([name, value]) => (
      <div key={name} className="flex flex-col gap-1">
        <span className="h-3 max-w-full rounded-full bg-kit-gold/40" style={{ width: value }} />
        <Label name={`w-${name} · max-w-${name}`} value={value} />
      </div>
    ))}
    {Object.entries({ ...GUTTERS, ...SCREENS }).map(([name, value]) => (
      <Label key={name} name={name} value={value} />
    ))}
  </Section>
);

/** The shell's title shadows over a painting, as its titles wear them. */
const TitleShadowsSection = () => (
  <Section title="Title shadows">
    <div className="painted relative flex flex-col gap-4 rounded-plate p-6">
      <img
        {...paintingSources("stormy")}
        sizes="100vw"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      {(["title", "title-flat"] as const).map((name) => (
        <div key={name} className="flex flex-col gap-1">
          <span className="font-display text-title" style={{ textShadow: SHELL_FINISH.textShadow[name] }}>
            Season of the Spires
          </span>
          <Label name={`text-shadow-${name}`} value={SHELL_FINISH.textShadow[name]} />
        </div>
      ))}
    </div>
  </Section>
);
