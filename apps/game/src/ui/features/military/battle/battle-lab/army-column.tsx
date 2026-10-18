import { cn } from "@/ui/design-system/atoms/lib/utils";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { DROPDOWN_TRIGGER, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { SelectRelic } from "@/ui/design-system/molecules/select-relic";
import { SelectTier } from "@/ui/design-system/molecules/select-tier";
import { SelectTroop } from "@/ui/design-system/molecules/select-troop";
import { StaminaManager } from "@bibliothecadao/eternum";
import { ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";

import type { GuardOption, WorkingArmy } from "./battle-lab.types";
import { TierChip } from "../../utils/tier-chip";

const MAX_TROOPS_PER_ARMY = 500_000;

interface ArmyColumnProps {
  label: string;
  side: "attacker" | "defender";
  army: WorkingArmy;
  onChange: (patch: Partial<WorkingArmy>) => void;
  /** Structure-attacker guard slots (live mode). */
  guards?: GuardOption[];
  selectedGuardSlot?: number | null;
  onSelectGuard?: (slot: number) => void;
  /** Per-side post-fight readout rendered at the bottom of the card. */
  footer?: React.ReactNode;
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className={cn("flex items-center gap-1.5", "text-hud-label text-hud-muted")}>
      {label}
      {hint && <span className="text-hud-label text-hud-cue">{hint}</span>}
    </span>
    {children}
  </label>
);

export const ArmyColumn = ({
  label,
  side,
  army,
  onChange,
  guards,
  selectedGuardSlot,
  onSelectGuard,
  footer,
}: ArmyColumnProps) => {
  const accent = side === "attacker" ? "bg-red-500" : "bg-blue-500";
  // The army's own maximum where the chain gives it, else what its type and tier allow.
  const maxStamina = StaminaManager.getMaxStamina(army.troopType, army.tier, army.maxStamina);

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl p-4", OVERLAY_SURFACE_BASE)}>
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", accent)} />
        <span className="text-hud-label text-hud-accent">{label}</span>
        <TierChip tier={String(army.tier)} />
      </div>

      {guards && guards.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {guards.map((guard) => {
            const active = guard.slot === selectedGuardSlot;
            return (
              <button
                key={guard.slot}
                type="button"
                onClick={() => onSelectGuard?.(guard.slot)}
                className={cn(
                  "rounded border px-2 py-1 text-hud-label transition-colors",
                  active
                    ? "border-hud-line-strong bg-hud-chosen text-hud-accent"
                    : "border-hud-line bg-hud-well text-hud-muted hover:border-hud-line-strong",
                )}
                aria-pressed={active}
              >
                {guard.label} · {guard.army.troopCount.toLocaleString()}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Stamina" hint={`${army.stamina}/${maxStamina}`}>
          <NumberInput
            value={army.stamina}
            onChange={(stamina) => onChange({ stamina })}
            min={0}
            max={maxStamina}
            step={1}
          />
        </Field>
        <Field label="Troops" hint={army.troopCount.toLocaleString()}>
          <NumberInput
            value={army.troopCount}
            onChange={(troopCount) => onChange({ troopCount })}
            min={1}
            max={MAX_TROOPS_PER_ARMY}
            step={100}
          />
        </Field>
        <Field label="Type">
          <SelectTroop
            defaultValue={army.troopType}
            onSelect={(troopType) => troopType && onChange({ troopType: troopType as TroopType })}
            className={DROPDOWN_TRIGGER}
          />
        </Field>
        <Field label="Tier">
          <SelectTier
            defaultValue={army.tier}
            onSelect={(tier) => tier && onChange({ tier: tier as TroopTier })}
            className={DROPDOWN_TRIGGER}
          />
        </Field>
      </div>

      <SelectRelic
        label="Active Relics"
        defaultValue={army.relics}
        onSelect={(relics) => onChange({ relics: relics as ResourcesIds[] })}
        allowMultiple
        filterTypes={["Damage", "Damage Reduction", "Stamina"]}
        className="w-full"
      />

      {footer}
    </div>
  );
};
