import { HudSelect } from "@/ui/design-system/kit/hud-elements";
import { useAutomationStore, type RealmEntityType } from "@/hooks/store/use-automation-store";
import { automationRefusal, presetLine } from "./automation-words";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { inferRealmPreset, REALM_PRESETS, type RealmPresetId } from "@bibliothecadao/eternum/automation";

export function AutomationPresetSwitch({ entityId, entityType }: { entityId: number; entityType: RealmEntityType }) {
  const realmId = String(entityId);
  const automation = useAutomationStore((state) => state.realms[realmId]);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const ordersAllowed = useUIStore(canIssueOrders);
  const refusal = automationRefusal(ordersAllowed, hydrated);
  const selectPreset = (presetId: RealmPresetId) => {
    if (!canIssueOrders() || !hydrated) return;
    const store = useAutomationStore.getState();
    store.upsertRealm(realmId, { entityType, presetId });
    store.setRealmPreset(realmId, presetId);
  };
  const preset = inferRealmPreset(automation);
  return (
    // The realm card's header holds it: its keys choose here, never the map's shortcuts.
    <span
      className="inline-flex"
      data-tip={refusal ?? presetLine(preset)}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <HudSelect
        label="Production automation"
        value={preset}
        options={REALM_PRESETS.map((entry) => ({ value: entry.id, label: entry.label }))}
        disabled={refusal !== null}
        onChange={selectPreset}
      />
    </span>
  );
}
