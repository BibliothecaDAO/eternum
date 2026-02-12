import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { generateMetaTags } from "@/lib/og-image";
import { formatScrollDate, getPublishedScrollPosts } from "@/lib/scroll";

type ScrollFilter = "all" | "update" | "thought-piece";

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

function ScrollIndexPage() {
  const { posts } = Route.useLoaderData();
  const [filter, setFilter] = useState<ScrollFilter>("all");

  const filteredPosts = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter((post) => post.type === filter);
  }, [filter, posts]);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-4xl mx-auto"
      >
        <h1 className="text-3xl md:text-5xl font-bold">Scroll</h1>
        <p className="text-muted-foreground mt-3 mb-8">
          Updates from the ecosystem and thought pieces.
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { id: "all", label: "All" },
            { id: "update", label: "Updates" },
            { id: "thought-piece", label: "Thought Pieces" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id as ScrollFilter)}
              className={`px-3 py-1.5 text-sm border transition-colors ${
                filter === option.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/60"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <article
              key={post.slug}
              className="border border-border bg-card/50 p-5 md:p-6 hover:border-primary/60 transition-colors"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                <span>{post.type === "update" ? "Update" : "Thought Piece"}</span>
                <span className="mx-2">•</span>
                <span>{formatScrollDate(post.date)}</span>
                <span className="mx-2">•</span>
                <span>{post.readingTimeMinutes} min read</span>
              </div>

              <h2 className="text-xl md:text-2xl font-semibold mt-2 mb-2">
                <Link
                  to="/scroll/$slug"
                  params={{ slug: post.slug }}
                  className="hover:text-primary transition-colors"
                >
                  {post.title}
                </Link>
              </h2>

              <p className="text-muted-foreground">{post.excerpt}</p>

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
            </article>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
