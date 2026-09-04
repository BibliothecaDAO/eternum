import type { ReactNode } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import type { FactoryMoreOptionField } from "../map-options";
import type { FactoryDurationOption } from "../types";

export const FACTORY_FIELD_CONTROL_CLASS_NAME =
  "mt-2 block h-11 w-full min-w-0 max-w-full rounded-[18px] border border-gold/15 bg-black/25 px-3 text-left text-[13px] text-gold outline-none transition-colors focus:border-gold/30 backdrop-blur-[6px] md:px-4 md:text-center md:text-sm";

export const FACTORY_SELECT_CONTROL_CLASS_NAME = `${FACTORY_FIELD_CONTROL_CLASS_NAME} appearance-none pr-11 font-medium`;

export const FactoryV2StartSectionCard = ({
  title,
  description,
  appearanceClassName,
  children,
}: {
  title: string;
  description: string;
  appearanceClassName: string;
  children: ReactNode;
}) => (
  <section
    className={cn(
      "space-y-4 rounded-[24px] border border-gold/10 px-4 py-4 text-left sm:px-5 sm:py-5",
      appearanceClassName,
    )}
  >
    <div className="mx-auto max-w-sm space-y-1 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42">{title}</div>
      <p className="text-sm leading-5 text-gold/50">{description}</p>
    </div>
    {children}
  </section>
);

export const FactoryV2DurationField = ({
  durationMinutes,
  durationOptions,
  appearanceClassName,
  onChange,
}: {
  durationMinutes: number;
  durationOptions: FactoryDurationOption[];
  appearanceClassName: string;
  onChange: (value: number) => void;
}) => (
  <div className="min-w-0">
    <label
      htmlFor="factory-duration"
      className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42"
    >
      Duration
    </label>
    <div className="relative mt-2">
      <select
        id="factory-duration"
        value={String(durationMinutes)}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn(FACTORY_SELECT_CONTROL_CLASS_NAME, appearanceClassName)}
      >
        {durationOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/45" />
    </div>
  </div>
);

export const FactoryV2InlineOptionField = ({
  field,
  value,
  error,
  onChange,
}: {
  field: FactoryMoreOptionField;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) => (
  <label className="block rounded-[20px] border border-gold/10 bg-black/25 px-4 py-3.5">
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-5 text-gold/74">{field.label}</span>
        <span className="block text-[11px] leading-4 text-gold/38">{field.helperText}</span>
      </div>
      <div
        className={cn(
          "flex h-9 items-center gap-1 rounded-full border bg-black/25 px-2.5 shadow-none",
          error ? "border-rose-400/70" : "border-gold/15",
        )}
      >
        <input
          type="number"
          inputMode={field.inputMode}
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-16 border-0 bg-transparent p-0 text-right text-[13px] font-semibold text-gold outline-none"
        />
        {field.unitLabel ? (
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gold/42">{field.unitLabel}</span>
        ) : null}
      </div>
    </div>
    {error ? <span className="mt-1 block text-[11px] leading-5 text-rose-700">{error}</span> : null}
  </label>
);

export const FactoryV2PlayStyleOption = ({
  label,
  isEnabled,
  appearanceClassName,
  onClick,
}: {
  label: string;
  isEnabled: boolean;
  appearanceClassName: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={isEnabled}
    className={cn(
      "w-full rounded-[18px] border px-4 py-3 text-left transition-all duration-200",
      isEnabled
        ? "border-gold/25 bg-black/30 text-gold shadow-[0_8px_20px_rgba(0,0,0,0.16)]"
        : cn(appearanceClassName, "text-gold/70 shadow-none"),
    )}
  >
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
          isEnabled ? "border-gold bg-gold" : "border-gold/25 bg-transparent",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-colors duration-200",
            isEnabled ? "bg-[#15110f]" : "bg-transparent",
          )}
        />
      </span>
      <span className="text-[13px] font-semibold leading-5">{label}</span>
    </div>
  </button>
);

export const FactoryV2LaunchTargetButton = ({
  label,
  description,
  isSelected,
  appearanceClassName,
  onClick,
}: {
  label: string;
  description: string;
  isSelected: boolean;
  appearanceClassName: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-[20px] border px-4 py-3 text-left transition-colors",
      isSelected ? "border-gold/20 bg-black/30 text-gold shadow-[0_8px_20px_rgba(0,0,0,0.16)]" : appearanceClassName,
    )}
  >
    <div className="text-[13px] font-semibold leading-5">{label}</div>
    <div className="mt-1 text-[11px] leading-5 text-gold/48">{description}</div>
  </button>
);
