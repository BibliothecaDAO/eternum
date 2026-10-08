import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/ui/design-system/kit/button";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";

import { formatContentDay } from "../clock-chip";
import { PageFrame } from "../frame/page-frame";
import { NothingHere } from "../not-found";
import { LEARN_WORDS } from "../words";
import { publishedPosts } from "./news";

/**
 * A post (spec 13): Back, its title, date and reading time (its art waits for the posts' own; their cover is the web
 * app's), the body in a 68-character reading column, and Newer
 * and Older as one stepper at the foot.
 */
export const PostPage = () => {
  const { post: slug } = useParams();
  const navigate = useNavigate();
  const index = publishedPosts.findIndex((post) => post.slug === slug);
  const post = publishedPosts[index];
  if (!post)
    return (
      <PageFrame back="/learn">
        <NothingHere />
      </PageFrame>
    );
  const newer = publishedPosts[index - 1];
  const older = publishedPosts[index + 1];
  return (
    <PageFrame
      back="/learn"
      foot={
        <div className="mx-auto flex w-full max-w-[760px] gap-2">
          {newer && (
            <Button
              role="outline"
              word={LEARN_WORDS.newer}
              icon="Ar"
              className="flex-1"
              onClick={() => navigate(`/learn/${newer.slug}`)}
            />
          )}
          {older && (
            <Button
              role="outline"
              word={LEARN_WORDS.older}
              icon="Ar"
              className="flex-1"
              onClick={() => navigate(`/learn/${older.slug}`)}
            />
          )}
        </div>
      }
    >
      <article className="mx-auto flex max-w-[760px] flex-col gap-3">
        <h1 className="font-ui text-[26px] font-bold leading-tight text-kit-cream">{post.title}</h1>
        <p className="flex items-center gap-2 text-[13px] text-kit-muted">
          <KitIcon code="Cl" size={18} />
          {formatContentDay(post.date)} · {LEARN_WORDS.minutes(post.readingTimeMinutes)}
        </p>
        <div
          className="prose prose-invert max-w-[68ch] text-[17px] leading-[26px] prose-headings:font-ui prose-headings:text-kit-cream prose-p:text-kit-cream prose-a:text-kit-peach prose-strong:text-kit-cream prose-li:text-kit-cream prose-blockquote:border-kit-line2 prose-blockquote:text-kit-muted"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </article>
    </PageFrame>
  );
};
