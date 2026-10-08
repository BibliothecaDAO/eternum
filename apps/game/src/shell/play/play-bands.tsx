import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";

import { COMMUNITY } from "../community";
import { MODE_GUIDES } from "../learn/guides";
import { paintingSources } from "../paintings";
import { PLAY_WORDS } from "../words";
import { AgeLabel } from "./age-card";
import { AGES, isLocked } from "./ages";

type Age = (typeof AGES)[number];

/** A band below Play's first screen on the desktop: its title in the display face, then its content. */
const Band = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-5">
    <h2 className="font-display text-[34px] leading-none text-kit-cream">{title}</h2>
    {children}
  </section>
);

/** The four ages as the chronicle tells them, each on its lore painting; a card opens the age's page. */
export const AgesBand = () => (
  <Band title={PLAY_WORDS.fourAges}>
    <div className="grid grid-cols-4 gap-5">
      {AGES.map((age) => (
        <LoreCard key={age.mode} age={age} />
      ))}
    </div>
  </Band>
);

/** An age's lore card: its name, the chronicle's era and line, and how it plays (Dominion has no guide yet). */
const LoreCard = ({ age }: { age: Age }) => {
  const guide = MODE_GUIDES.find((candidate) => candidate.mode === age.mode);
  return (
    <article
      className={cn(
        "painted flex h-[420px] flex-col justify-end gap-2 rounded-2xl p-5 min-[1800px]:h-[520px]",
        isLocked(age.mode) && "brightness-75 grayscale",
      )}
    >
      <img
        {...paintingSources(age.painting)}
        sizes="25vw"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-kit-ground/40 to-kit-ground/95" />
      <Link to={age.page} aria-label={age.name} className="absolute inset-0" />
      <AgeLabel numeral={age.numeral} />
      <h3 className="font-display text-[40px] leading-none text-kit-cream min-[1800px]:text-[46px]">{age.name}</h3>
      <p className="font-ui text-[14px] tracking-[.06em] text-kit-gold">{age.era}</p>
      <p className="text-[15px] leading-snug text-kit-cream">{age.caption}</p>
      {guide && (
        <a
          href={guide.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex min-h-10 items-center gap-1.5 self-start font-ui text-[15px] text-kit-peach hover:text-kit-gold2"
        >
          {guide.title}
          <KitIcon code="Ar" size={16} />
        </a>
      )}
    </article>
  );
};

/** Where the realm talks: Discord, X, Telegram and GitHub. */
export const CommunityBand = () => (
  <Band title={PLAY_WORDS.joinTheRealm}>
    <div className="grid grid-cols-4 gap-5">
      {COMMUNITY.map((place) => (
        <a
          key={place.name}
          href={place.href}
          target="_blank"
          rel="noopener noreferrer"
          className="plate flex flex-col gap-1 p-5 hover:border-kit-gold"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="mb-2 size-7 fill-kit-cream">
            <path d={place.mark} />
          </svg>
          <b className="font-ui text-[17px] text-kit-cream">{place.name}</b>
          <span className="text-[14px] text-kit-muted">{place.line}</span>
        </a>
      ))}
    </div>
  </Band>
);
