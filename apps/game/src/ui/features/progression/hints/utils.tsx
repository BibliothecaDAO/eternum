export const tableOfContents = (chapterTitles: string[]) => (
  <div className="mb-8">
    <ul className="grid grid-cols-2 gap-4">
      {chapterTitles.map((title) => (
        <li key={title} className="transition-colors">
          <a className="text-light-pink hover:text-pink-400 flex items-center space-x-2 group" href={`#${title}`}>
            <span className="text-sm opacity-50 group-hover:opacity-100">→</span>
            <span>{title}</span>
          </a>
        </li>
      ))}
    </ul>
  </div>
);
