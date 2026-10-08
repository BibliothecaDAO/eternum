import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { SettingRow, SettingRows } from "../profile/setting-row";
import { Band } from "../band";
import { paintingSources } from "../paintings";
import { AgeLabel } from "../play/age-card";
import { AGES, ageOf, isLocked } from "../play/ages";
import { LEARN_WORDS, WORDS } from "../words";
import { MODE_GUIDES, PLAYER_GUIDES } from "./guides";
import { NewsRows, newsItems } from "./news";

type LearnView = "guides" | "news";

/** The navigation state that opens Learn on News (the Scroll's address on a phone). */
export const OPEN_ON_NEWS: { learnView: LearnView } = { learnView: "news" };

/**
 * Learn (spec 13): a guide per mode and the players' guides, and News; a switch above the one list on a phone with
 * Terms · Privacy at the foot (the Scroll's address opens it on News). The desktop sets the guides on their ages'
 * paintings, then the chronicle of the four ages and News, and ends on the footer.
 */
export const LearnPage = () => {
  const layout = useLayout();
  const opensOn = (useLocation().state as Partial<typeof OPEN_ON_NEWS> | null)?.learnView ?? "guides";
  const [view, setView] = useState<LearnView>(opensOn);
  return (
    <PageFrame title={WORDS.learn} foot={layout === "phone" && <LegalLinks />} footer>
      {layout === "phone" ? (
        <div className="flex flex-col gap-3">
          <ViewSwitch
            label={LEARN_WORDS.guides}
            views={[
              { id: "guides", word: LEARN_WORDS.guides },
              { id: "news", word: LEARN_WORDS.news },
            ]}
            lit={view}
            onChange={setView}
          />
          {view === "guides" ? <Guides /> : <News />}
        </div>
      ) : (
        <DesktopLearn />
      )}
    </PageFrame>
  );
};

const Guides = () => {
  const [players, setPlayers] = useState(false);
  return (
    <>
      <SettingRows>
        {MODE_GUIDES.map((guide) => (
          <SettingRow key={guide.url} icon={guide.icon} name={guide.title} onOpen={() => openOutside(guide.url)} />
        ))}
        <SettingRow icon="Pp" name={LEARN_WORDS.byPlayers} onOpen={() => setPlayers(true)} />
      </SettingRows>
      {players && <PlayerGuides onClose={() => setPlayers(false)} />}
    </>
  );
};

const openOutside = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

/** The guides players wrote, each by its author, in a sheet. */
const PlayerGuides = ({ onClose }: { onClose: () => void }) => (
  <Sheet label={LEARN_WORDS.byPlayers} onClose={onClose}>
    <SettingRows>
      {PLAYER_GUIDES.map((guide) => (
        <SettingRow
          key={guide.url}
          icon="Pc"
          name={guide.title}
          value={guide.source}
          onOpen={() => openOutside(guide.url)}
        />
      ))}
    </SettingRows>
  </Sheet>
);

const DesktopLearn = () => {
  const [players, setPlayers] = useState(false);
  return (
    <div className="flex flex-col gap-14">
      <div className="grid h-[210px] grid-cols-4 gap-5 min-[1800px]:h-[260px]">
        {MODE_GUIDES.map((guide) => (
          <GuideCard key={guide.url} guide={guide} />
        ))}
        <button
          type="button"
          onClick={() => setPlayers(true)}
          className="plate flex flex-col items-start justify-end gap-1 p-5 text-left hover:border-kit-gold"
        >
          <KitIcon code="Pp" size={36} />
          <b className="font-ui text-[19px] text-kit-cream">{LEARN_WORDS.byPlayers}</b>
          <span className="text-[14px] text-kit-muted">{LEARN_WORDS.guidesCount(PLAYER_GUIDES.length)}</span>
        </button>
      </div>
      <Band
        title={LEARN_WORDS.chronicle}
        aside={<span className="text-[15px] text-kit-muted">{LEARN_WORDS.lostAges}</span>}
      >
        <div className="grid grid-cols-2 gap-5">
          {AGES.map((age) => (
            <ChronicleEntry key={age.mode} age={age} />
          ))}
        </div>
      </Band>
      <Band title={LEARN_WORDS.news}>
        <News />
      </Band>
      {players && <PlayerGuides onClose={() => setPlayers(false)} />}
    </div>
  );
};

/** A mode's guide on its age's painting; it opens the docs. */
const GuideCard = ({ guide }: { guide: (typeof MODE_GUIDES)[number] }) => {
  const age = ageOf(guide.mode);
  return (
    <a
      href={guide.url}
      target="_blank"
      rel="noopener noreferrer"
      className="painted flex flex-col justify-end gap-1 rounded-2xl p-5"
    >
      <img
        {...paintingSources(age.painting)}
        sizes="25vw"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-kit-ground/30 to-kit-ground/95" />
      <AgeLabel numeral={age.numeral} />
      <b className="font-ui text-[19px] text-kit-cream">{guide.title}</b>
    </a>
  );
};

/** An age as the chronicle tells it: its painting, numeral, name and era, and the lore site's telling. */
const ChronicleEntry = ({ age }: { age: (typeof AGES)[number] }) => (
  <article className="plate flex gap-5 p-4">
    <span
      className={cn("painted block h-32 w-48 shrink-0 rounded-xl", isLocked(age.mode) && "brightness-75 grayscale")}
    >
      <img
        {...paintingSources(age.painting)}
        sizes="12rem"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
    </span>
    <div className="flex min-w-0 flex-col gap-1.5">
      <AgeLabel numeral={age.numeral} />
      <h3 className="font-display text-[34px] leading-none text-kit-cream">{age.name}</h3>
      <p className="font-ui text-[14px] tracking-[.06em] text-kit-gold">{age.era}</p>
      <p className="text-[15px] leading-snug text-kit-cream">{age.chronicle}</p>
    </div>
  </article>
);

const News = () => (
  <SettingRows>
    <NewsRows items={newsItems()} />
  </SettingRows>
);

/** The legal pages, at Learn's foot. */
const LegalLinks = () => (
  <nav className="flex items-center justify-center gap-3 text-[15px] text-kit-muted">
    <Link to="/terms" className="flex min-h-12 items-center px-2">
      <KitIcon code="Dk" size={18} className="mr-1.5" />
      {LEARN_WORDS.terms}
    </Link>
    <span aria-hidden>·</span>
    <Link to="/privacy" className="flex min-h-12 items-center px-2">
      {LEARN_WORDS.privacy}
    </Link>
  </nav>
);
