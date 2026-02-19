import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { generateMetaTags } from "@/lib/og-image";
import { formatScrollDate, getPublishedScrollPosts } from "@/lib/scroll";

type ScrollFilter = "all" | "update" | "thought-piece";

const filterOptions = [
  { id: "all", label: "All Dispatches" },
  { id: "update", label: "Updates" },
  { id: "thought-piece", label: "Thought Pieces" },
] as const;

export const Route = createFileRoute("/scroll/")({
  loader: async () => {
    return {
      posts: getPublishedScrollPosts(),
    };
  },
  component: ScrollIndexPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Scroll - Realms World",
      description: "Updates from the ecosystem and thought pieces.",
      path: "/scroll",
    }),
  }),
});

function typeLabel(type: "update" | "thought-piece") {
  return type === "update" ? "Update" : "Thought Piece";
}

function ScrollIndexPage() {
  const { posts } = Route.useLoaderData();
  const [filter, setFilter] = useState<ScrollFilter>("all");

  const filteredPosts = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter((post) => post.type === filter);
  }, [filter, posts]);

  const featuredPost = filteredPosts[0];
  const feedPosts = filteredPosts.slice(1);
  const updateCount = useMemo(
    () => posts.filter((post) => post.type === "update").length,
    [posts]
  );
  const thoughtCount = useMemo(
    () => posts.filter((post) => post.type === "thought-piece").length,
    [posts]
  );
  const totalReadingMinutes = useMemo(
    () => posts.reduce((total, post) => total + post.readingTimeMinutes, 0),
    [posts]
  );

  return (
    <section className="realm-section scroll-codex-stage relative py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 space-y-6 sm:space-y-8"
      >
        <header className="realm-panel realm-grid-scan scroll-codex-hero rounded-2xl p-5 sm:p-7">
          <p className="realm-banner mb-4">Signal Archive</p>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <h1 className="realm-title text-3xl sm:text-4xl lg:text-5xl leading-tight">
                Scroll Codex Dispatches
              </h1>
              <p className="mt-3 text-base sm:text-lg text-foreground/80">
                The written layer for Realms. Read ecosystem updates, design notes,
                and strategic thought pieces published as an open chronicle.
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <span className="realm-sigil">{posts.length} entries</span>
              <span className="realm-sigil">{filteredPosts.length} visible</span>
            </div>
          </div>

          <div className="scroll-codex-metrics mt-5">
            <article className="scroll-codex-metric">
              <p className="realm-sigil">Updates Logged</p>
              <p className="mt-2 text-2xl font-semibold text-primary tabular-nums">
                {updateCount}
              </p>
            </article>
            <article className="scroll-codex-metric">
              <p className="realm-sigil">Thought Pieces</p>
              <p className="mt-2 text-2xl font-semibold text-primary tabular-nums">
                {thoughtCount}
              </p>
            </article>
            <article className="scroll-codex-metric">
              <p className="realm-sigil">Reading Minutes</p>
              <p className="mt-2 text-2xl font-semibold text-primary tabular-nums">
                {totalReadingMinutes}
              </p>
            </article>
          </div>
        </header>

        <div className="realm-panel scroll-codex-filters rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap gap-2.5">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id as ScrollFilter)}
                className={`scroll-codex-filter ${
                  filter === option.id
                    ? "scroll-codex-filter-active"
                    : "scroll-codex-filter-idle"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {featuredPost ? (
          <Link
            to="/scroll/$slug"
            params={{ slug: featuredPost.slug }}
            className="scroll-codex-feature realm-panel realm-grid-scan block rounded-2xl p-5 sm:p-7 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.13em] text-foreground/60">
              <span>{typeLabel(featuredPost.type)}</span>
              <span>•</span>
              <span>{formatScrollDate(featuredPost.date)}</span>
              <span>•</span>
              <span>{featuredPost.readingTimeMinutes} min read</span>
            </div>

            <h2 className="realm-title mt-3 text-2xl sm:text-3xl lg:text-4xl leading-tight">
              {featuredPost.title}
            </h2>

            <p className="mt-3 text-foreground/80 text-base sm:text-lg max-w-3xl">
              {featuredPost.excerpt}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {featuredPost.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-primary/25 bg-black/35 px-2 py-1 text-xs text-foreground/78"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </Link>
        ) : null}

        {feedPosts.length > 0 ? (
          <div className="scroll-codex-feed grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {feedPosts.map((post) => (
              <article
                key={post.slug}
                className="scroll-codex-card realm-panel rounded-2xl p-5 md:p-6"
              >
                <div className="text-xs uppercase tracking-[0.13em] text-foreground/60">
                  <span>{typeLabel(post.type)}</span>
                  <span className="mx-2">•</span>
                  <span>{formatScrollDate(post.date)}</span>
                  <span className="mx-2">•</span>
                  <span>{post.readingTimeMinutes} min read</span>
                </div>

                <h3 className="text-xl md:text-2xl font-semibold mt-2 mb-2">
                  <Link
                    to="/scroll/$slug"
                    params={{ slug: post.slug }}
                    className="scroll-codex-link transition-colors"
                  >
                    {post.title}
                  </Link>
                </h3>

                <p className="text-foreground/76">{post.excerpt}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-primary/22 bg-black/30 px-2 py-1 text-xs text-foreground/72"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {filteredPosts.length === 0 ? (
          <div className="realm-panel rounded-xl p-8 text-center">
            <p className="text-foreground/70">No dispatches match this filter.</p>
          </div>
        ) : null}
      </motion.div>
    </section>
  );
}
