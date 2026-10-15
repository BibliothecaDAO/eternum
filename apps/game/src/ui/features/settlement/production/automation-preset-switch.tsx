import { useAutomationStore, type RealmEntityType } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { inferRealmPreset, type RealmPresetId } from "@bibliothecadao/eternum/automation";

const PRESETS = [
  { id: "smart", label: "Smart" },
  { id: "idle", label: "Idle" },
  { id: "custom", label: "Custom" },
] as const;

export function AutomationPresetSwitch({ entityId, entityType }: { entityId: number; entityType: RealmEntityType }) {
  const realmId = String(entityId);
  const automation = useAutomationStore((state) => state.realms[realmId]);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const ordersAllowed = useUIStore(canIssueOrders);
  const selectPreset = (presetId: RealmPresetId) => {
    if (!canIssueOrders() || !hydrated) return;
    const store = useAutomationStore.getState();
    store.upsertRealm(realmId, { entityType, presetId });
    store.setRealmPreset(realmId, presetId);
  };
  return (
    <AutomationPresetSwitchView
      value={inferRealmPreset(automation)}
      disabled={!ordersAllowed || !hydrated}
      onChange={selectPreset}
    />
  );
}

export function AutomationPresetSwitchView({
  value,
  disabled = false,
  onChange,
}: {
  value: RealmPresetId;
  disabled?: boolean;
  onChange: (value: RealmPresetId) => void;
}) {
  return (
    <select
      data-notice
      aria-label="Production automation"
      value={value}
      disabled={disabled}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value as RealmPresetId)}
    >
      {PRESETS.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.label}
        </option>
      ))}
    </select>
  );
}
