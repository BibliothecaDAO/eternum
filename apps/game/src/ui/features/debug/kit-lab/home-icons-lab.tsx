import { REALM_LEVELS } from "@bibliothecadao/types";
import { HOME_KINDS, homeIcon, type HomeKind } from "@/ui/design-system/home-icons";
import { Icon } from "@/ui/design-system/icon";

/** The shipped selector at board size, with larger paintings where there is room to inspect them. */
export function HomeIconsLab() {
  return (
    <section data-lab="home-icons" aria-label="Home icons by kind and level" className="mx-auto max-w-5xl p-3">
      <h1 className="!mb-6">Home icons</h1>
      <div
        className="grid grid-cols-[5rem_repeat(4,minmax(0,1fr))] items-center gap-y-6 text-center text-xs md:text-sm"
        role="table"
        aria-label="Home kind by realm level"
      >
        <span role="columnheader">Home</span>
        {REALM_LEVELS.map((label) => (
          <span role="columnheader" key={label} className="whitespace-nowrap !text-[11px] md:!text-sm">
            {label}
          </span>
        ))}
        {(Object.keys(HOME_KINDS) as HomeKind[]).map((kind) => (
          <div role="row" className="contents" key={kind}>
            <span role="rowheader">{HOME_KINDS[kind].label}</span>
            {REALM_LEVELS.map((label, level) => (
              <div
                role="cell"
                key={level}
                data-home-kind={kind}
                data-home-level={level}
                className="flex flex-col items-center gap-4"
              >
                <Icon name={homeIcon(kind, level)} size={28} alt={`${HOME_KINDS[kind].label} · ${label}`} />
                <Icon name={homeIcon(kind, level)} size={96} className="hidden md:block" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
