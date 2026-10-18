import { createContext, type ReactNode, useContext } from "react";

export type Device = "desktop" | "phone";
/** Which device the lab draws the sheet for: on a phone, the sheet's column alone, at a phone's width and sizes. */
export const DeviceContext = createContext<Device>("desktop");

/** One element of the style sheet: its name and rule, the sheet's version, and the game's today beside it. */
export const Element = ({
  name,
  rule,
  sheet,
  today,
  wide = false,
  todayLabel = "Today in the game",
}: {
  name: string;
  rule: string;
  sheet: ReactNode;
  today: ReactNode;
  /** A study too wide for two columns: the sheet takes the width, today follows under it. */
  wide?: boolean;
  /** What the right-hand column shows: the game's elements today, or the app's. */
  todayLabel?: string;
}) => {
  const phone = useContext(DeviceContext) === "phone";
  return (
    <section data-sheet-element={name} className="rounded-lg border border-white/10 bg-black/20 p-4">
      <header data-lab-chrome className="mb-3 flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-bold text-white">{name}</h2>
        <p className="text-sm text-white/60">{rule}</p>
      </header>
      {phone ? (
        <div className="overflow-x-auto">{sheet}</div>
      ) : wide ? (
        <div className="flex flex-col gap-4">
          {sheet}
          <div className="flex flex-wrap items-start gap-3 border-t border-white/10 pt-3">
            <p data-lab-chrome className="w-full text-xs uppercase tracking-wide text-red-300/80">
              {todayLabel}
            </p>
            {today}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-6">
          <div>
            <p data-lab-chrome className="mb-2 text-xs uppercase tracking-wide text-emerald-300/80">
              Sheet
            </p>
            {sheet}
          </div>
          <div className="border-l border-white/10 pl-6">
            <p data-lab-chrome className="mb-2 text-xs uppercase tracking-wide text-red-300/80">
              {todayLabel}
            </p>
            <div className="flex flex-wrap items-start gap-3">{today}</div>
          </div>
        </div>
      )}
    </section>
  );
};
