import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";
import {
  formatScrollDate,
  getScrollPostBySlug,
  getScrollPostNeighbors,
  getSimilarScrollPosts,
} from "@/lib/scroll";

export const Route = createFileRoute("/scroll/$slug")({
  loader: async ({ params }) => {
    const post = getScrollPostBySlug(params.slug);
    if (!post) {
      throw new Error("Scroll post not found");
    }

    const { older, newer } = getScrollPostNeighbors(params.slug);
    const similarPosts = getSimilarScrollPosts(params.slug, 3);
    return { post, older, newer, similarPosts };
  },
  component: ScrollPostPage,
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) return {};

    return {
      meta: generateMetaTags({
        title: `${post.title} - Scroll - Realms World`,
        description: post.excerpt,
        image: post.coverImage,
        path: `/scroll/${post.slug}`,
        type: "article",
      }),
      links: post.canonicalUrl
        ? [{ rel: "canonical", href: post.canonicalUrl }]
        : undefined,
    };
  },
});

function typeLabel(type: "update" | "thought-piece") {
  return type === "update" ? "Update" : "Thought Piece";
}

function ScrollPostPage() {
  const { post, older, newer, similarPosts } = Route.useLoaderData();

  return (
    <section className="realm-section scroll-scriptorium-stage relative py-10 sm:py-14">
      <motion.article
        className="w-full px-4 sm:px-6 lg:px-8 xl:px-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
          <header className="realm-panel realm-grid-scan scroll-detail-hero rounded-2xl p-5 sm:p-7">
            <Link to="/scroll" className="scroll-detail-back inline-flex items-center">
              Back to Scroll
            </Link>

            <p className="realm-banner mt-4">Codex Entry</p>

            <div className="mt-4 text-xs uppercase tracking-[0.13em] text-foreground/60">
              <span>{typeLabel(post.type)}</span>
              <span className="mx-2">•</span>
              <span>{formatScrollDate(post.date)}</span>
              <span className="mx-2">•</span>
              <span>{post.readingTimeMinutes} min read</span>
            </div>

            <h1 className="realm-title mt-3 text-3xl md:text-5xl leading-tight">
              {post.title}
            </h1>

            <p className="mt-3 text-foreground/80 text-base sm:text-lg">{post.excerpt}</p>
            <p className="mt-3 text-sm text-foreground/65">By {post.author}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-primary/25 bg-black/35 px-2 py-1 text-xs text-foreground/78"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </header>

          <div className="scroll-hero scroll-detail-cover mt-6 mb-2">
            {post.coverImage ? (
              <img src={post.coverImage} alt={post.title} className="scroll-hero-image" />
            ) : (
              <div className="scroll-hero-image" />
            )}
            <div className="scroll-hero-overlay" />
            <div className="scroll-hero-eyebrow">Scroll Article</div>
          </div>

          <section className="realm-panel scroll-detail-body rounded-2xl p-5 sm:p-8">
            <div
              className="scroll-content"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          </section>

          <footer className="scroll-detail-neighbors grid grid-cols-1 md:grid-cols-2 gap-4">
            {newer ? (
              <Link
                to="/scroll/$slug"
                params={{ slug: newer.slug }}
                className="realm-panel scroll-detail-neighbor-card block rounded-xl p-4"
              >
                <p className="text-xs uppercase tracking-[0.13em] text-foreground/55">
                  Newer Entry
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground/90">{newer.title}</p>
              </Link>
            ) : (
              <div className="realm-panel scroll-detail-neighbor-card rounded-xl p-4 opacity-55">
                <p className="text-xs uppercase tracking-[0.13em] text-foreground/55">
                  Newer Entry
                </p>
                <p className="mt-2 text-sm text-foreground/60">No newer post</p>
              </div>
            )}

            {older ? (
              <Link
                to="/scroll/$slug"
                params={{ slug: older.slug }}
                className="realm-panel scroll-detail-neighbor-card block rounded-xl p-4"
              >
                <p className="text-xs uppercase tracking-[0.13em] text-foreground/55">
                  Older Entry
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground/90">{older.title}</p>
              </Link>
            ) : (
              <div className="realm-panel scroll-detail-neighbor-card rounded-xl p-4 opacity-55">
                <p className="text-xs uppercase tracking-[0.13em] text-foreground/55">
                  Older Entry
                </p>
                <p className="mt-2 text-sm text-foreground/60">No older post</p>
              </div>
            )}
          </footer>

          {similarPosts.length > 0 ? (
            <section className="realm-panel scroll-detail-similar rounded-2xl p-5 sm:p-6">
              <h2 className="realm-title text-2xl font-semibold mb-4">Similar Scrolls</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {similarPosts.map((candidate) => (
                  <Link
                    key={candidate.slug}
                    to="/scroll/$slug"
                    params={{ slug: candidate.slug }}
                    className="similar-scroll-card scroll-detail-similar-card"
                  >
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {candidate.type === "update" ? "Update" : "Thought Piece"}
                    </p>
                    <p className="text-lg font-semibold mt-1 line-clamp-2">
                      {candidate.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                      {candidate.excerpt}
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">
                      {formatScrollDate(candidate.date)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </motion.article>
    </section>
  );
}
