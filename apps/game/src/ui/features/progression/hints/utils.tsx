export const tableOfContents = (chapterTitles: string[]) => (
  <div className="mb-8">
    <ul className="grid grid-cols-2 gap-4">
      {chapterTitles.map((title) => (
        <li key={title} className="transition-colors">
          <a className="flex items-center space-x-2 text-hud-accent" href={`#${title}`}>
            <span className="text-hud-label text-hud-cue">→</span>
            <span>{title}</span>
          </a>
        </li>
      ))}
    </ul>
  </div>
);
