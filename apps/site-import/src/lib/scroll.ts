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

export function getSimilarScrollPosts(slug: string, limit = 3) {
  const posts = getPublishedScrollPosts();
  const currentPost = posts.find((post) => post.slug === slug);

  if (!currentPost) {
    return [];
  }

  const withScores = posts
    .filter((post) => post.slug !== slug)
    .map((post) => {
      const sharedTags = post.tags.filter((tag) =>
        currentPost.tags.includes(tag)
      ).length;
      const sameTypeBonus = post.type === currentPost.type ? 1 : 0;
      const score = sharedTags * 2 + sameTypeBonus;

      return { post, score };
    });

  return withScores
    .sort((a, b) => {
      if (a.score === b.score) {
        if (a.post.date === b.post.date) {
          return a.post.slug.localeCompare(b.post.slug);
        }
        return a.post.date < b.post.date ? 1 : -1;
      }
      return b.score - a.score;
    })
    .slice(0, limit)
    .map((entry) => entry.post);
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
