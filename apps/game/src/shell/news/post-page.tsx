import { NEWS_WORDS } from "@/ui/design-system/kit/words";
import { formatContentDay } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/ui/design-system/kit/button";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import type { ScrollPost } from "../generated/scroll-posts";
import { NothingHere } from "../not-found";
import { Panel } from "@/ui/design-system/kit/panel";
import { Title } from "@/ui/design-system/kit/title";
import { PaintedCard } from "@/ui/design-system/kit/painted-card";
import { ListRow } from "@/ui/design-system/kit/list-row";
import { postHref, postKind, postPainting, publishedPosts, WHATS_NEW_PATH } from "./posts";

/**
 * A post (spec 13), read inside What's new: Back to What's new, its title, date and reading time, the body in a 68-character
 * reading column, and Newer and Older as one stepper at the foot. The desktop heads it with its cover and keeps the
 * Scroll's other posts beside it.
 */
export const PostPage = () => {
  const { post: slug } = useParams();
  const layout = useLayout();
  const index = publishedPosts.findIndex((post) => post.slug === slug);
  const post = publishedPosts[index];
  if (!post)
    return (
      <PageFrame back={WHATS_NEW_PATH}>
        <NothingHere />
      </PageFrame>
    );
  return (
    <PageFrame
      back={WHATS_NEW_PATH}
      title={layout === "desktop" ? NEWS_WORDS.scroll : undefined}
      foot={<Stepper newer={publishedPosts[index - 1]} older={publishedPosts[index + 1]} />}
      footer
    >
      {layout === "phone" ? <PhonePost post={post} /> : <DesktopPost post={post} />}
    </PageFrame>
  );
};

const Stepper = ({ newer, older }: { newer: ScrollPost | undefined; older: ScrollPost | undefined }) => {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-prose gap-2">
      {newer && (
        <Button
          role="outline"
          word={NEWS_WORDS.newer}
          icon="arrow-right"
          className="flex-1"
          onClick={() => navigate(postHref(newer))}
        />
      )}
      {older && (
        <Button
          role="outline"
          word={NEWS_WORDS.older}
          icon="arrow-right"
          className="flex-1"
          onClick={() => navigate(postHref(older))}
        />
      )}
    </div>
  );
};

const PhonePost = ({ post }: { post: ScrollPost }) => (
  <article className="mx-auto flex max-w-prose flex-col gap-3">
    <Title level="headline" face="body" className="leading-tight">
      {post.title}
    </Title>
    <PostDate post={post} />
    <PostBody post={post} />
  </article>
);

/**
 * The cover across the page with the title on it from its top, then the reading column with the Scroll's other posts
 * beside it.
 */
const DesktopPost = ({ post }: { post: ScrollPost }) => (
  <div className="flex flex-col gap-8">
    <PaintedCard
      as="header"
      painting={postPainting(post)}
      sizes="100vw"
      grade="cover"
      className="flex flex-col gap-2 p-8"
    >
      <span className="font-body text-base text-kit-gold">{postKind(post)}</span>
      <Title level="hero" className="max-w-headline">
        {post.title}
      </Title>
      <PostDate post={post} />
    </PaintedCard>
    <div className="grid grid-cols-[minmax(0,theme(maxWidth.prose))_20rem] justify-center gap-10">
      <PostBody post={post} />
      <aside>
        <Panel icon="chronicles" title={NEWS_WORDS.scroll}>
          {publishedPosts
            .filter((other) => other.slug !== post.slug)
            .map((other) => (
              <ListRow
                key={other.slug}
                to={postHref(other)}
                height={12}
                className="px-1 py-2 font-body text-base text-kit-cream hover:text-kit-gold2"
              >
                {other.title}
              </ListRow>
            ))}
        </Panel>
      </aside>
    </div>
  </div>
);

const PostDate = ({ post }: { post: ScrollPost }) => (
  <p className="flex items-center gap-2 text-sm text-kit-muted">
    <SemanticIcon name="clock" size={18} />
    {formatContentDay(post.date)} · {NEWS_WORDS.minutes(post.readingTimeMinutes)}
  </p>
);

const PostBody = ({ post }: { post: ScrollPost }) => (
  <div
    className="prose prose-invert max-w-measure text-base leading-[26px] prose-headings:font-body prose-headings:text-kit-cream prose-p:text-kit-cream prose-a:text-kit-peach prose-strong:text-kit-cream prose-li:text-kit-cream prose-blockquote:border-kit-line2 prose-blockquote:text-kit-muted"
    dangerouslySetInnerHTML={{ __html: post.html }}
  />
);
