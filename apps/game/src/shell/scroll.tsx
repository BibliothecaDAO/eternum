import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { scrollPosts, type ScrollPost, type ScrollPostType } from "./generated/scroll-posts";
import { Panel, PanelTitle, Pill } from "./kit";
import { NotFoundPage } from "./not-found";

/** The scroll: the written layer of Realms, built from content/scroll at build time and served as plain data. */

type ScrollFilter = "all" | ScrollPostType;

const FILTERS: { id: ScrollFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "update", label: "Updates" },
  { id: "thought-piece", label: "Thought pieces" },
];

const publishedPosts = scrollPosts.filter((post) => post.published);

const typeLabel = (type: ScrollPostType): string => (type === "update" ? "Update" : "Thought piece");

const formatDate = (date: string): string => {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(year, month - 1, day),
  );
};

/** Posts sharing tags with this one first, then by type, then newest. */
const similarPosts = (post: ScrollPost, limit = 3): ScrollPost[] =>
  publishedPosts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => ({
      candidate,
      score:
        candidate.tags.filter((tag) => post.tags.includes(tag)).length * 2 + (candidate.type === post.type ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.candidate.date.localeCompare(a.candidate.date))
    .slice(0, limit)
    .map((entry) => entry.candidate);

const PostMeta = ({ post }: { post: ScrollPost }) => (
  <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.13em] text-gold/60">
    <span>{typeLabel(post.type)}</span>
    <span>·</span>
    <span>{formatDate(post.date)}</span>
    <span>·</span>
    <span>{post.readingTimeMinutes} min read</span>
  </div>
);

const Tags = ({ tags }: { tags: string[] }) => (
  <div className="mt-3 flex flex-wrap gap-2">
    {tags.map((tag) => (
      <Pill key={tag} tone="cold">
        #{tag}
      </Pill>
    ))}
  </div>
);

const PostCard = ({ post, featured = false }: { post: ScrollPost; featured?: boolean }) => (
  <Link to={`/scroll/${post.slug}`} className="block">
    <Panel className="h-full transition-colors hover:border-gold/50">
      <PostMeta post={post} />
      <h2 className={`mt-2 font-cinzel font-semibold text-gold ${featured ? "text-2xl sm:text-3xl" : "text-lg"}`}>
        {post.title}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-gold/70">{post.excerpt}</p>
      <Tags tags={post.tags} />
    </Panel>
  </Link>
);

export const ScrollIndexPage = () => {
  const [filter, setFilter] = useState<ScrollFilter>("all");
  const posts = useMemo(
    () => (filter === "all" ? publishedPosts : publishedPosts.filter((post) => post.type === filter)),
    [filter],
  );
  const [featured, ...rest] = posts;

  return (
    <div className="mx-auto max-w-[880px] space-y-4">
      <div>
        <PanelTitle>The Scroll</PanelTitle>
        <p className="text-[13px] text-gold/70">
          Ecosystem updates, design notes and thought pieces from the Realms team.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter posts">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] ${
              filter === option.id
                ? "border-gold/60 bg-gold/15 text-gold"
                : "border-gold/20 text-gold/60 hover:text-gold"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {featured ? <PostCard post={featured} featured /> : <p className="text-[13px] text-gold/60">No posts yet.</p>}
      {rest.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const NeighbourLink = ({ label, post }: { label: string; post: ScrollPost | undefined }) =>
  post ? (
    <Link to={`/scroll/${post.slug}`} className="block">
      <Panel className="h-full transition-colors hover:border-gold/50">
        <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gold/50">{label}</span>
        <p className="mt-1 text-[14px] font-semibold text-gold">{post.title}</p>
      </Panel>
    </Link>
  ) : null;

export const ScrollPostPage = () => {
  const { slug } = useParams();
  const index = publishedPosts.findIndex((post) => post.slug === slug);
  if (index === -1) return <NotFoundPage />;
  const post = publishedPosts[index];
  const newer = publishedPosts[index - 1];
  const older = publishedPosts[index + 1];
  const similar = similarPosts(post);

  return (
    <article className="mx-auto max-w-[880px] space-y-4">
      <Link to="/scroll" className="font-mono text-[11px] uppercase tracking-[0.13em] text-gold/60 hover:text-gold">
        ← The Scroll
      </Link>
      <header>
        <PostMeta post={post} />
        <h1 className="mt-2 font-cinzel text-2xl font-semibold text-gold sm:text-4xl">{post.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gold/80">{post.excerpt}</p>
        <p className="mt-2 text-[12px] text-gold/60">By {post.author}</p>
        <Tags tags={post.tags} />
      </header>
      <Panel>
        <div
          className="prose prose-invert max-w-none prose-headings:font-cinzel prose-headings:text-gold prose-p:text-gold/80 prose-a:text-gold prose-strong:text-gold prose-li:text-gold/80 prose-blockquote:border-gold/50 prose-blockquote:text-gold/70 prose-code:text-gold"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </Panel>
      {newer || older ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <NeighbourLink label="Newer" post={newer} />
          <NeighbourLink label="Older" post={older} />
        </div>
      ) : null}
      {similar.length > 0 ? (
        <section>
          <PanelTitle>Similar posts</PanelTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            {similar.map((candidate) => (
              <PostCard key={candidate.slug} post={candidate} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
};
