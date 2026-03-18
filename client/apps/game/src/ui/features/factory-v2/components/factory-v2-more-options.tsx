import { useEffect, useState } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import type { FactoryMapOptionSection, FactoryMapOptionsDraft, FactoryMapOptionsErrors } from "../map-options";
import type { FactoryGameMode } from "../types";

const buildInitialExpandedSectionIds = (sections: FactoryMapOptionSection[]) =>
  sections[0] ? [sections[0].id] : [];

const buildSectionIdSignature = (sections: FactoryMapOptionSection[]) => sections.map((section) => section.id).join("|");

export const FactoryV2MoreOptions = ({
  mode,
  isOpen,
  sections,
  draft,
  errors,
  invalidReason,
  onToggle,
  onValueChange,
}: {
  mode: FactoryGameMode;
  isOpen: boolean;
  sections: FactoryMapOptionSection[];
  draft: FactoryMapOptionsDraft;
  errors: FactoryMapOptionsErrors;
  invalidReason: string | null;
  onToggle: () => void;
  onValueChange: (fieldId: keyof FactoryMapOptionsDraft, value: string) => void;
}) => {
  const [expandedSectionIds, setExpandedSectionIds] = useState(() => buildInitialExpandedSectionIds(sections));
  const sectionIdSignature = buildSectionIdSignature(sections);

  useEffect(() => {
    setExpandedSectionIds((currentSectionIds) => {
      const visibleSectionIds = new Set(sections.map((section) => section.id));
      const retainedSectionIds = currentSectionIds.filter((sectionId) => visibleSectionIds.has(sectionId));

      return retainedSectionIds.length > 0 ? retainedSectionIds : buildInitialExpandedSectionIds(sections);
    });
  }, [sectionIdSignature]);

  if (sections.length === 0) {
    return null;
  }

  const toggleSection = (sectionId: FactoryMapOptionSection["id"]) => {
    setExpandedSectionIds((currentSectionIds) =>
      currentSectionIds.includes(sectionId)
        ? currentSectionIds.filter((currentId) => currentId !== sectionId)
        : [...currentSectionIds, sectionId],
    );
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "w-full rounded-[20px] border border-black/10 bg-white/55 px-4 py-3 text-left transition-colors hover:border-black/20",
          mode === "blitz" ? "hover:bg-white/75" : "hover:bg-white/70",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-black">More options</span>
              {invalidReason ? (
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  Needs review
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-black/45">Chance fields use percentages. Time fields use minutes where shown.</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 flex-shrink-0 text-black/55 transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen ? (
        <div className="space-y-2 rounded-[20px] border border-black/10 bg-white/45 p-3 text-left">
          <p className="text-[11px] uppercase tracking-[0.16em] text-black/40">Compact overrides for this launch only.</p>

          {sections.map((section) => (
            <div key={section.id} className="overflow-hidden rounded-[18px] border border-black/10 bg-white/60">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={expandedSectionIds.includes(section.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/55"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-black/58">{section.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-black/42">
                    <span>{section.description}</span>
                    <span>•</span>
                    <span>{section.fields.length} fields</span>
                    {section.fields.some((field) => Boolean(errors[field.id])) ? (
                      <>
                        <span>•</span>
                        <span className="text-rose-700">Check values</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 flex-shrink-0 text-black/45 transition-transform",
                    expandedSectionIds.includes(section.id) && "rotate-180",
                  )}
                />
              </button>

              {expandedSectionIds.includes(section.id) ? (
                <div className="space-y-2 border-t border-black/8 px-3 py-2.5">
                  {section.fields.map((field) => (
                    <label key={field.id} className="block rounded-[16px] border border-black/8 bg-white/80 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium leading-5 text-black/74">{field.label}</span>
                          <span className="block text-[11px] leading-4 text-black/38">{field.helperText}</span>
                        </div>
                        <div
                          className={cn(
                            "flex h-8 items-center gap-1 rounded-full border bg-white px-2.5 shadow-[0_1px_0_rgba(255,255,255,0.55)]",
                            errors[field.id] ? "border-rose-400/70" : "border-black/10",
                          )}
                        >
                          <input
                            type="number"
                            inputMode={field.inputMode === "percentage" ? "decimal" : "numeric"}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={draft[field.id]}
                            onChange={(event) => onValueChange(field.id, event.target.value)}
                            className={cn(
                              "h-7 border-0 bg-transparent p-0 text-right text-[13px] font-semibold text-black outline-none",
                              field.inputMode === "percentage" ? "w-16" : "w-20",
                            )}
                          />
                          {field.unitLabel ? (
                            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/42">
                              {field.unitLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {errors[field.id] ? (
                        <span className="mt-1 block text-[11px] leading-5 text-rose-700">{errors[field.id]}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ))}

          {invalidReason && !sections.some((section) => section.fields.some((field) => Boolean(errors[field.id]))) ? (
            <p className="text-[11px] leading-5 text-rose-700">{invalidReason}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
