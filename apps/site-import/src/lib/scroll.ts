import { scrollPosts, type ScrollPost } from "@/generated/scroll-posts";

export type { ScrollPost };

export function getAllScrollPosts() {
  return scrollPosts;
}

export function getPublishedScrollPosts() {
  return scrollPosts.filter((post) => post.published);
}

export function getScrollPostBySlug(slug: string) {
  return scrollPosts.find((post) => post.slug === slug && post.published);
}

export function getScrollPostNeighbors(slug: string) {
  const posts = getPublishedScrollPosts();
  const index = posts.findIndex((post) => post.slug === slug);

  if (index === -1) {
    return { newer: null, older: null };
  }

  return {
    newer: index > 0 ? posts[index - 1] : null,
    older: index < posts.length - 1 ? posts[index + 1] : null,
  };
}

export function formatScrollDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}
