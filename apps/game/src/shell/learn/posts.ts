import { type ScrollPost, scrollPosts } from "../generated/scroll-posts";
import type { Painting } from "../paintings";
import { AGES } from "../play/ages";
import { LEARN_WORDS } from "../words";

/** The Scroll's published posts, newest first. */
export const publishedPosts: ScrollPost[] = scrollPosts.filter((post) => post.published);

/** The Scroll's address: Play's Scroll band on the desktop, Learn's News on a phone. */
export const SCROLL_PATH = "/scroll";

/** A post is read inside Play: the Scroll is folded into it. */
export const postHref = (post: Pick<ScrollPost, "slug">) => `${SCROLL_PATH}/${post.slug}`;

/**
 * A post's cover until the posts carry art of their own (theirs is the web app's card): the painting of the first age
 * it is tagged with, else the first visit's plains.
 */
export const postPainting = (post: Pick<ScrollPost, "tags">): Painting =>
  AGES.find((age) => post.tags.includes(age.mode))?.painting ?? "dark-plains";

export const postKind = (post: Pick<ScrollPost, "type">) =>
  post.type === "thought-piece" ? LEARN_WORDS.thoughtPiece : LEARN_WORDS.update;
