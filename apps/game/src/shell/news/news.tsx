import { PROFILE_WORDS } from "@/ui/design-system/kit/words";
import { formatContentDay } from "@bibliothecadao/types";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Sheet } from "@/ui/design-system/kit/sheet";
import { latestFeatures } from "@/ui/features/world/latest-features";

import { PageFrame } from "../frame/page-frame";
import { SettingRow, SettingRows } from "@/ui/design-system/kit/setting-row";
import { postHref, publishedPosts } from "./posts";

/**
 * What's new (spec 13), a row under You and the Scroll's address: the Scroll's posts and the latest changes in one list,
 * newest first. It ends on the footer, which holds the community and the legal pages.
 */
export const WhatsNewPage = () => (
  <PageFrame back="/profile" title={PROFILE_WORDS.whatsNew} footer>
    <div className="max-w-feed">
      <SettingRows>
        <NewsRows items={newsItems()} />
      </SettingRows>
    </div>
  </PageFrame>
);

/** One entry of What's new: a post, or a change from the latest-features list. */
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

/** What's new's rows; a post opens its page, a change its sheet. */
const NewsRows = ({ items }: { items: readonly NewsItem[] }) => {
  const navigate = useNavigate();
  const [change, setChange] = useState<Extract<NewsItem, { kind: "change" }> | null>(null);
  return (
    <>
      {items.map((item) => (
        <SettingRow
          key={item.key}
          icon="chronicles"
          name={item.title}
          value={formatContentDay(item.date)}
          onOpen={() => (item.kind === "post" ? navigate(postHref(item)) : setChange(item))}
        />
      ))}
      {change && (
        <Sheet label={change.title} onClose={() => setChange(null)} placement="page">
          <h2 className="pt-1 font-body text-lg font-bold text-kit-cream">{change.title}</h2>
          <p className="text-sm text-kit-muted">{formatContentDay(change.date)}</p>
          <p className="pb-2 text-base leading-[26px] text-kit-cream">{change.description}</p>
        </Sheet>
      )}
    </>
  );
};
