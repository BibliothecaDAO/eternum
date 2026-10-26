/** The pages the showcase serves beside the lab, out of the repository: its owner footage, reels and marketing. */
const PAGES = [
  { path: "/reels/", title: "Owner Blitz footage", line: "Clips, highlights and stills from the owner's Blitz games" },
  { path: "/hype3/", title: "Hype reels", line: "The Blitz trailers, teasers and reels, 16:9 and 9:16" },
  { path: "/announce/", title: "Announcement", line: "The launch announcement and its Discord drafts" },
  { path: "/story/", title: "Story", line: "The story article and its images" },
  { path: "/emails/", title: "Emails", line: "The launch emails at each size" },
  { path: "/brand/", title: "Brand", line: "The brand deck, fonts and images" },
];

/**
 * Dev only: the footage and the pages made from it (Studio → Footage). They live in the lanes' evidence and are linked
 * into the showcase's public folder by showcase.sh, so they open only on a server that links them.
 */
export const FootageView = () => (
  <main className="mx-auto flex max-w-3xl flex-col gap-3 p-6 font-sans text-hud-ink">
    <p className="text-hud-body text-hud-muted">
      Served beside the lab by the showcase; another server has none of them.
    </p>
    <ul className="grid gap-3 sm:grid-cols-2">
      {PAGES.map((page) => (
        <li key={page.path}>
          <a
            href={page.path}
            target="_blank"
            rel="noreferrer"
            className="block rounded border border-hud-line p-4 hover:bg-hud-hover"
          >
            <span className="block text-hud-strong text-hud-gold">{page.title}</span>
            <span className="text-hud-label text-hud-muted">{page.line}</span>
          </a>
        </li>
      ))}
    </ul>
  </main>
);
