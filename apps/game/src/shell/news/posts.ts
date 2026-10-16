import { type ScrollPost, scrollPosts } from "../generated/scroll-posts";
import type { Painting } from "../paintings";
import { AGES } from "../play/ages";
import { NEWS_WORDS } from "../words";

/** The Scroll's published posts, newest first. */
export const publishedPosts: ScrollPost[] = scrollPosts.filter((post) => post.published);

/** What's new: the Scroll's address, which realms.world links. */
export const WHATS_NEW_PATH = "/scroll";

/** A post's own address, under the Scroll's. */
export const postHref = (post: Pick<ScrollPost, "slug">) => `${WHATS_NEW_PATH}/${post.slug}`;

/**
 * A post's cover until the posts carry art of their own (theirs is the web app's card): the painting of the first age
 * it is tagged with, else the first visit's plains.
 */
export const postPainting = (post: Pick<ScrollPost, "tags">): Painting =>
  AGES.find((age) => post.tags.includes(age.mode))?.painting ?? "dark-plains";

export const postKind = (post: Pick<ScrollPost, "type">) =>
  post.type === "thought-piece" ? NEWS_WORDS.thoughtPiece : NEWS_WORDS.update;
