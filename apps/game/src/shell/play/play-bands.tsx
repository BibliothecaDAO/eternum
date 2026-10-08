import { type ReactNode, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";

import { formatContentDay } from "../clock-chip";
import { COMMUNITY } from "../community";
import type { ScrollPost } from "../generated/scroll-posts";
import { MODE_GUIDES } from "../learn/guides";
import { NewsRows, newsItems } from "../learn/news";
import { postHref, postKind, postPainting, publishedPosts, SCROLL_PATH } from "../learn/posts";
import { paintingSources } from "../paintings";
import { SettingRows } from "../profile/setting-row";
import { LEARN_WORDS, PLAY_WORDS } from "../words";
import { AgeLabel } from "./age-card";
import { AGES, isLocked } from "./ages";

type Age = (typeof AGES)[number];

/** A band below Play's first screen on the desktop: its title in the display face (a link at its end), then its content. */
const Band = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <section className="flex flex-col gap-5">
    <header className="flex items-end justify-between">
      <h2 className="font-display text-[34px] leading-none text-kit-cream">{title}</h2>
      {aside}
    </header>
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

/**
 * The Scroll, read inside Play: its three newest posts on their covers, then the rest of News; Learn keeps all of it.
 * The Scroll's own address lands here.
 */
export const ScrollBand = () => {
  const landing = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === SCROLL_PATH) landing.current?.scrollIntoView();
  }, [pathname]);
  const covers = publishedPosts.slice(0, 3);
  const rest = newsItems()
    .filter((item) => item.kind === "change" || !covers.some((post) => post.slug === item.slug))
    .slice(0, 5);
  return (
    <div ref={landing} className="scroll-mt-6">
      <Band
        title={LEARN_WORDS.scroll}
        aside={
          <Link to="/learn" className="flex min-h-10 items-center gap-1.5 font-ui text-[15px] text-kit-peach">
            {LEARN_WORDS.allNews}
            <KitIcon code="Ar" size={16} />
          </Link>
        }
      >
        <div className="grid grid-cols-3 gap-5">
          {covers.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        <SettingRows>
          <NewsRows items={rest} />
        </SettingRows>
      </Band>
    </div>
  );
};

const PostCard = ({ post }: { post: ScrollPost }) => (
  <Link to={postHref(post)} className="group flex flex-col gap-2">
    <span className="painted block h-[160px] rounded-2xl min-[1800px]:h-[200px]">
      <img
        {...paintingSources(postPainting(post))}
        sizes="33vw"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
    </span>
    <span className="flex items-center gap-2 font-ui text-[13px]">
      <span className="text-kit-gold">{postKind(post)}</span>
      <span className="text-kit-muted">
        {formatContentDay(post.date)} · {LEARN_WORDS.minutes(post.readingTimeMinutes)}
      </span>
    </span>
    <b className="font-ui text-[19px] leading-snug text-kit-cream group-hover:text-kit-gold2">{post.title}</b>
  </Link>
);

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
