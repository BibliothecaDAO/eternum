import { cn } from "@/ui/design-system/atoms/lib/utils";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { HudButton, HudPanel, HudSelect } from "@/ui/design-system/kit/hud-elements";
import { SelectRelic } from "@/ui/design-system/molecules/select-relic";
import { StaminaManager } from "@bibliothecadao/eternum";
import { ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";

import type { GuardOption, WorkingArmy } from "./battle-lab.types";
import { TierChip } from "../../utils/tier-chip";

const MAX_TROOPS_PER_ARMY = 500_000;

const TROOP_TYPES = [
  { value: TroopType.Knight, label: "Knight" },
  { value: TroopType.Crossbowman, label: "Crossbow" },
  { value: TroopType.Paladin, label: "Paladin" },
] as const;

const TIERS = [TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => ({ value: tier, label: tier }));

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
    <span className="flex items-center gap-1.5 text-hud-label text-hud-muted">
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
  const accent = side === "attacker" ? "bg-hud-enemy" : "bg-hud-ally";
  // The army's own maximum where the chain gives it, else what its type and tier allow.
  const maxStamina = StaminaManager.getMaxStamina(army.troopType, army.tier, army.maxStamina);

  return (
    <HudPanel
      title={
        <span className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", accent)} />
          {label}
        </span>
      }
      cue={<TierChip tier={String(army.tier)} />}
      collapsible={false}
    >
      <div className="flex flex-col gap-3">
        {guards && guards.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {guards.map((guard) => {
              const active = guard.slot === selectedGuardSlot;
              return (
                <HudButton
                  key={guard.slot}
                  kind="secondary"
                  size="sm"
                  onClick={() => onSelectGuard?.(guard.slot)}
                  aria-pressed={active}
                >
                  {guard.label} · {guard.army.troopCount.toLocaleString()}
                </HudButton>
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
            <HudSelect
              label="Troop type"
              value={army.troopType}
              options={TROOP_TYPES}
              onChange={(troopType) => onChange({ troopType })}
            />
          </Field>
          <Field label="Tier">
            <HudSelect label="Tier" value={army.tier} options={TIERS} onChange={(tier) => onChange({ tier })} />
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
    </HudPanel>
  );
};
