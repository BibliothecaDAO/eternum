export const tableOfContents = (chapterTitles: string[]) => (
  <div className="">
    <ul className="grid grid-cols-2">
      {chapterTitles.map((title) => (
        <li key={title}>
          <a className="text-light-pink" href={`#${title}`}>
            {title}
          </a>
        </li>
      ))}
    </ul>
  </div>
);
