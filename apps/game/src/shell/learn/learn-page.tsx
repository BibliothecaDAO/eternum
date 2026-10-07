import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import { latestFeatures } from "@/ui/features/world/latest-features";

import { formatContentDay } from "../clock-chip";
import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { type ScrollPost, scrollPosts } from "../generated/scroll-posts";
import { SettingRow, SettingRows } from "../profile/setting-row";
import { LEARN_WORDS } from "../words";
import { MODE_GUIDES, PLAYER_GUIDES } from "./guides";

type LearnView = "guides" | "news";

/** The Scroll's published posts, newest first: News's pages. */
export const publishedPosts: ScrollPost[] = scrollPosts.filter((post) => post.published);

/** News: the Scroll's posts and the latest changes in one list, newest first; a post opens its page. */
type NewsItem =
  | { kind: "post"; key: string; title: string; date: string; slug: string }
  | { kind: "change"; key: string; title: string; date: string; description: string };

const newsItems = (): NewsItem[] =>
  [
    ...publishedPosts.map(
      (post): NewsItem => ({ kind: "post", key: post.slug, title: post.title, date: post.date, slug: post.slug }),
    ),
    ...latestFeatures.map(
      (change): NewsItem => ({
        kind: "change",
        key: `${change.date}:${change.title}`,
        title: change.title,
        date: change.date,
        description: change.description,
      }),
    ),
  ].toSorted((a, b) => b.date.localeCompare(a.date));

/**
 * Learn (spec 13): a guide per mode and the players' guides, and News; a switch above the one list on a phone, both
 * side by side on desktop; Terms · Privacy at the foot.
 */
export const LearnPage = () => {
  const layout = useLayout();
  const [view, setView] = useState<LearnView>("guides");
  return (
    <PageFrame foot={<LegalLinks />}>
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
        <div className="grid grid-cols-2 items-start gap-6">
          <Guides />
          <News />
        </div>
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
          <SettingRow
            key={guide.url}
            icon={guide.icon}
            name={guide.title}
            onOpen={() => window.open(guide.url, "_blank", "noopener,noreferrer")}
          />
        ))}
        <SettingRow icon="Pp" name={LEARN_WORDS.byPlayers} onOpen={() => setPlayers(true)} />
      </SettingRows>
      {players && (
        <Sheet label={LEARN_WORDS.byPlayers} onClose={() => setPlayers(false)}>
          <SettingRows>
            {PLAYER_GUIDES.map((guide) => (
              <SettingRow
                key={guide.url}
                icon="Pc"
                name={guide.title}
                value={guide.source}
                onOpen={() => window.open(guide.url, "_blank", "noopener,noreferrer")}
              />
            ))}
          </SettingRows>
        </Sheet>
      )}
    </>
  );
};

const News = () => {
  const navigate = useNavigate();
  const [change, setChange] = useState<Extract<NewsItem, { kind: "change" }> | null>(null);
  return (
    <>
      <SettingRows>
        {newsItems().map((item) => (
          <SettingRow
            key={item.key}
            icon="Pc"
            name={item.title}
            value={formatContentDay(item.date)}
            onOpen={() => (item.kind === "post" ? navigate(`/learn/${item.slug}`) : setChange(item))}
          />
        ))}
      </SettingRows>
      {change && (
        <Sheet label={change.title} onClose={() => setChange(null)}>
          <h2 className="pt-1 font-ui text-[19px] font-bold text-kit-cream">{change.title}</h2>
          <p className="text-[13px] text-kit-muted">{formatContentDay(change.date)}</p>
          <p className="pb-2 text-[17px] leading-[26px] text-kit-cream">{change.description}</p>
        </Sheet>
      )}
    </>
  );
};

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
