import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Sheet } from "@/ui/design-system/kit/sheet";
import { latestFeatures } from "@/ui/features/world/latest-features";

import { formatContentDay } from "../clock-chip";
import { SettingRow } from "../profile/setting-row";
import { postHref, publishedPosts } from "./posts";

/** News: the Scroll's posts and the latest changes in one list, newest first; a post opens its page. */
type NewsItem =
  | { kind: "post"; key: string; title: string; date: string; slug: string }
  | { kind: "change"; key: string; title: string; date: string; description: string };

export const newsItems = (): NewsItem[] =>
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

/** News's rows for the caller's plate; a post opens its page, a change its sheet. */
export const NewsRows = ({ items }: { items: readonly NewsItem[] }) => {
  const navigate = useNavigate();
  const [change, setChange] = useState<Extract<NewsItem, { kind: "change" }> | null>(null);
  return (
    <>
      {items.map((item) => (
        <SettingRow
          key={item.key}
          icon="Pc"
          name={item.title}
          value={formatContentDay(item.date)}
          onOpen={() => (item.kind === "post" ? navigate(postHref(item)) : setChange(item))}
        />
      ))}
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
