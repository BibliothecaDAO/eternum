import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";
import {
  formatScrollDate,
  getScrollPostBySlug,
  getScrollPostNeighbors,
} from "@/lib/scroll";

export const Route = createFileRoute("/scroll/$slug")({
  loader: async ({ params }) => {
    const post = getScrollPostBySlug(params.slug);
    if (!post) {
      throw new Error("Scroll post not found");
    }

    const { older, newer } = getScrollPostNeighbors(params.slug);
    return { post, older, newer };
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
  const { post, older, newer } = Route.useLoaderData();

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

        <header className="mt-6 mb-8">
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
      </motion.article>
    </div>
  );
}
