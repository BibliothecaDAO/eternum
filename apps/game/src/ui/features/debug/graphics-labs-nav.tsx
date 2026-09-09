import { NavLink } from "react-router-dom";

import { NAVIGATION_SECTIONS } from "@/ui/features/landing/context/navigation-config";

const LAB_SECTIONS = NAVIGATION_SECTIONS.filter((section) => section.id.endsWith("-lab"));

export function GraphicsLabsNav() {
  return (
    <nav className="flex flex-wrap gap-3 text-xs" aria-label="Graphics labs">
      {LAB_SECTIONS.map((section) => (
        <NavLink
          key={section.id}
          to={section.basePath}
          className={({ isActive }) => (isActive ? "text-emerald-200" : "text-stone-400 hover:text-stone-200")}
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
