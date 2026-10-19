import { formatContentDay } from "@bibliothecadao/types";
import { useNavigate } from "react-router-dom";

import { Icon } from "@/ui/design-system/icon";
import { AppPanel, AppRow } from "@/ui/design-system/kit/app-elements";
import { NEWS_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { latestFeatures } from "@/ui/features/world/latest-features";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { postHref, postKind, postPainting, publishedPosts } from "./posts";

/**
 * What's new (spec 13), a place of its own in the bar and the Scroll's address: the game's latest changes, each with
 * what it does for the player, and the Scroll's posts, each opening its page, newest first in both. The desktop shows
 * them side by side; a phone stacks them. It ends on the footer, which holds the community and the legal pages.
 */
export const WhatsNewPage = () => {
  const phone = useLayout() === "phone";
  return (
    <PageFrame title={WORDS.whatsNew} footer>
      <div className="flex flex-col gap-6">
        {phone && <h1 className="text-app-title text-app-ink">{WORDS.whatsNew}</h1>}
        <div
          className={phone ? "flex flex-col gap-6" : "grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-6"}
        >
          <ChangesPanel />
          <ScrollPanel />
        </div>
      </div>
    </PageFrame>
  );
};

/** The game's latest changes, each read whole in its row after its day, so a phone gives the words its width. */
const ChangesPanel = () => (
  <AppPanel icon="tools" title={NEWS_WORDS.changes} flush>
    {latestFeatures.map((change) => (
      <AppRow
        key={`${change.date}:${change.title}`}
        title={change.title}
        detail={`${formatContentDay(change.date)} · ${change.description}`}
      />
    ))}
  </AppPanel>
);

/** The Scroll's posts under the cover of its newest; each opens its page. */
const ScrollPanel = () => {
  const navigate = useNavigate();
  const newest = publishedPosts[0];
  return (
    <AppPanel icon="chronicles" title={NEWS_WORDS.scroll} painting={newest ? postPainting(newest) : undefined} flush>
      {publishedPosts.map((post) => (
        <AppRow
          key={post.slug}
          title={post.title}
          detail={`${postKind(post)} · ${NEWS_WORDS.minutes(post.readingTimeMinutes)}`}
          trail={
            <>
              {formatContentDay(post.date)}
              <Icon name="arrow-right" size={18} />
            </>
          }
          onClick={() => navigate(postHref(post))}
        />
      ))}
    </AppPanel>
  );
};
