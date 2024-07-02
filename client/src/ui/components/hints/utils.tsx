export const tableOfContents = (conceptNames: string[]) => (
  <div className="">
    <ul className="grid grid-cols-2">
      {conceptNames.map((name) => (
        <li key={name}>
          <a className="text-light-pink" href={`#${name}`}>
            {name}
          </a>
        </li>
      ))}
    </ul>
  </div>
);
