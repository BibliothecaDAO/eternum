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

function ScrollPostPage() {
  const { post, older, newer, similarPosts } = Route.useLoaderData();

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <motion.article
        className="max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Link
          to="/scroll"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Back to Scroll
        </Link>

        <div className="scroll-hero mt-6 mb-8">
          {post.coverImage ? (
            <img
              src={post.coverImage}
              alt={post.title}
              className="scroll-hero-image"
            />
          ) : (
            <div className="scroll-hero-image" />
          )}
          <div className="scroll-hero-overlay" />
          <div className="scroll-hero-eyebrow">Scroll Article</div>
        </div>

        <header className="mb-8">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            <span>{post.type === "update" ? "Update" : "Thought Piece"}</span>
            <span className="mx-2">•</span>
            <span>{formatScrollDate(post.date)}</span>
            <span className="mx-2">•</span>
            <span>{post.readingTimeMinutes} min read</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mt-3 mb-3">
            {post.title}
          </h1>
          <p className="text-muted-foreground">{post.excerpt}</p>
          <p className="text-sm text-muted-foreground mt-3">By {post.author}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-muted px-2 py-1 text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        </header>

        <div
          className="scroll-content"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        <footer className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row gap-4 md:justify-between">
          <div>
            {newer ? (
              <Link
                to="/scroll/$slug"
                params={{ slug: newer.slug }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Newer: {newer.title}
              </Link>
            ) : null}
          </div>
          <div className="md:text-right">
            {older ? (
              <Link
                to="/scroll/$slug"
                params={{ slug: older.slug }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Older: {older.title}
              </Link>
            ) : null}
          </div>
        </footer>

        {similarPosts.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">Similar Scrolls</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {similarPosts.map((candidate) => (
                <Link
                  key={candidate.slug}
                  to="/scroll/$slug"
                  params={{ slug: candidate.slug }}
                  className="similar-scroll-card"
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
      </motion.article>
    </div>
  );
}
