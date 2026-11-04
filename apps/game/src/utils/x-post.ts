/**
 * X's compose page in a new tab, its post written: the line, and the link when there is one. The game stays where it
 * was. Every way the game posts to X opens it here.
 */
const xPostHref = (text: string, url?: string) => {
  const post = new URL("https://x.com/intent/tweet");
  post.searchParams.set("text", text);
  if (url) post.searchParams.set("url", url);
  return post.href;
};

export const openXPost = (text: string, url?: string) => {
  window.open(xPostHref(text, url), "_blank", "noopener,noreferrer");
};
