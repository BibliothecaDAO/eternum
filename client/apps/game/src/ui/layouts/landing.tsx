import clsx from "clsx";
import { NavLink, Outlet } from "react-router-dom";
interface LandingLayoutProps {
  backgroundImage: string;
}

const SECTIONS = [
  { label: "Overview", path: "/" },
  { label: "Cosmetics", path: "/cosmetics" },
  { label: "Account", path: "/account" },
  { label: "Leaderboard", path: "/leaderboard" },
];

export const LandingLayout = ({ backgroundImage }: LandingLayoutProps) => {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black text-gold">
      <div className="absolute inset-0">
        <img
          alt="Eternum background"
          src={`/images/covers/blitz/${backgroundImage}.png`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex flex-col gap-6 px-6 py-6 lg:px-10">
          <nav aria-label="Landing sections" className="flex justify-center">
            <div className="flex flex-wrap gap-2 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur">
              {SECTIONS.map((section) => (
                <NavLink
                  key={section.path}
                  to={section.path}
                  end={section.path === "/"}
                  className={({ isActive }) =>
                    clsx(
                      "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                      isActive ? "bg-white/20 text-white" : "text-white/70 hover:text-white",
                    )
                  }
                >
                  {section.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </header>

        <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center px-6 py-10 lg:px-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
