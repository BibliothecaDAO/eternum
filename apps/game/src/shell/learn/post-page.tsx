import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/ui/design-system/kit/button";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";

import { formatContentDay } from "../clock-chip";
import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import type { ScrollPost } from "../generated/scroll-posts";
import { NothingHere } from "../not-found";
import { paintingSources } from "../paintings";
import { Panel } from "../panel";
import { LEARN_WORDS } from "../words";
import { postHref, postKind, postPainting, publishedPosts, SCROLL_PATH } from "./posts";

/**
 * A post (spec 13), read inside Play: Back to the Scroll, its title, date and reading time, the body in a 68-character
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
      <PageFrame back={SCROLL_PATH}>
        <NothingHere />
      </PageFrame>
    );
  return (
    <PageFrame
      back={SCROLL_PATH}
      title={layout === "desktop" ? LEARN_WORDS.scroll : undefined}
      foot={<Stepper newer={publishedPosts[index - 1]} older={publishedPosts[index + 1]} />}
    >
      {layout === "phone" ? <PhonePost post={post} /> : <DesktopPost post={post} />}
    </PageFrame>
  );
};

const Stepper = ({ newer, older }: { newer: ScrollPost | undefined; older: ScrollPost | undefined }) => {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-[760px] gap-2">
      {newer && (
        <Button
          role="outline"
          word={LEARN_WORDS.newer}
          icon="Ar"
          className="flex-1"
          onClick={() => navigate(postHref(newer))}
        />
      )}
      {older && (
        <Button
          role="outline"
          word={LEARN_WORDS.older}
          icon="Ar"
          className="flex-1"
          onClick={() => navigate(postHref(older))}
        />
      )}
    </div>
  );
};

const PhonePost = ({ post }: { post: ScrollPost }) => (
  <article className="mx-auto flex max-w-[760px] flex-col gap-3">
    <h1 className="font-ui text-[26px] font-bold leading-tight text-kit-cream">{post.title}</h1>
    <PostDate post={post} />
    <PostBody post={post} />
  </article>
);

/** The cover across the page with the title on it, then the reading column with the Scroll's other posts beside it. */
const DesktopPost = ({ post }: { post: ScrollPost }) => (
  <div className="flex flex-col gap-8">
    <header className="painted flex h-[300px] flex-col justify-end gap-2 rounded-2xl p-8 min-[1800px]:h-[380px]">
      <img
        {...paintingSources(postPainting(post))}
        sizes="100vw"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-kit-ground/40 to-kit-ground/95" />
      <span className="font-ui text-[15px] text-kit-gold">{postKind(post)}</span>
      <h1 className="max-w-[60rem] font-display text-[44px] leading-[1.05] text-kit-cream">{post.title}</h1>
      <PostDate post={post} />
    </header>
    <div className="grid grid-cols-[minmax(0,760px)_20rem] justify-center gap-10">
      <PostBody post={post} />
      <aside>
        <Panel icon="Pc" title={LEARN_WORDS.scroll}>
          {publishedPosts
            .filter((other) => other.slug !== post.slug)
            .map((other) => (
              <Link
                key={other.slug}
                to={postHref(other)}
                className="flex min-h-12 items-center border-b border-kit-line px-1 py-2 font-ui text-[15px] text-kit-cream last:border-b-0 hover:text-kit-gold2"
              >
                {other.title}
              </Link>
            ))}
        </Panel>
      </aside>
    </div>
  </div>
);

const PostDate = ({ post }: { post: ScrollPost }) => (
  <p className="flex items-center gap-2 text-[13px] text-kit-muted">
    <KitIcon code="Cl" size={18} />
    {formatContentDay(post.date)} · {LEARN_WORDS.minutes(post.readingTimeMinutes)}
  </p>
);

const PostBody = ({ post }: { post: ScrollPost }) => (
  <div
    className="prose prose-invert max-w-[68ch] text-[17px] leading-[26px] prose-headings:font-ui prose-headings:text-kit-cream prose-p:text-kit-cream prose-a:text-kit-peach prose-strong:text-kit-cream prose-li:text-kit-cream prose-blockquote:border-kit-line2 prose-blockquote:text-kit-muted"
    dangerouslySetInnerHTML={{ __html: post.html }}
  />
);
