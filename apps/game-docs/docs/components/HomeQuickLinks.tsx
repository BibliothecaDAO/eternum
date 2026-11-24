import SIDEBAR from "../../sidebar.json";

const HOME_QUICK_LINKS = SIDEBAR.flatMap((section) => section.items.filter((item) => "quick" in item && item.quick));

export function HomeQuickLinks() {
  return (
    <nav className="docs-home-quick" aria-label="Game catalogs">
      {HOME_QUICK_LINKS.map((item) => (
        <a key={item.link} href={item.link}>
          {item.text}
        </a>
      ))}
    </nav>
  );
}
