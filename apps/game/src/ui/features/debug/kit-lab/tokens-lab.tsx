import type { CSSProperties, ReactNode } from "react";

import { paintingSources } from "@/ui/design-system/kit/paintings";
import { COLORS, FONTS, GUTTERS, RADII, SCREENS, TEXT_SHADOWS, TYPE, WIDTHS } from "@/tokens";

/**
 * Dev only, at /lab/kit/tokens: every value in src/tokens.ts drawn from the token file itself, so the page cannot go
 * stale. Values are applied as inline styles because Tailwind only generates the class names it finds written out.
 */
export const TokensLab = () => (
  <main className="min-h-dvh bg-kit-ground px-4 py-6 font-body text-kit-cream">
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <ColoursSection />
      <FacesSection />
      <TypeSection />
      <RadiiSection />
      <ShadowsSection />
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

const ColoursSection = () => (
  <Section title="Colours">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Object.entries(COLORS).map(([name, value]) => (
        <div key={name} className="flex flex-col gap-1.5">
          <span className="h-14 rounded-control border border-kit-line" style={{ background: value }} />
          <Label name={name} value={value} />
        </div>
      ))}
    </div>
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

const ShadowsSection = () => (
  <Section title="Title shadows">
    <div className="painted relative flex flex-col gap-4 rounded-plate p-6">
      <img
        {...paintingSources("stormy")}
        sizes="100vw"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      {Object.entries(TEXT_SHADOWS).map(([name, value]) => (
        <div key={name} className="flex flex-col gap-1">
          <span className="font-display text-title" style={{ textShadow: value }}>
            Season of the Spires
          </span>
          <Label name={`text-shadow-${name}`} value={value} />
        </div>
      ))}
    </div>
  </Section>
);

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
