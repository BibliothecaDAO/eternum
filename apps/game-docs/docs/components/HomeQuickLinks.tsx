import { HOME_QUICK_LINKS } from "@/utils/sidebar";

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
