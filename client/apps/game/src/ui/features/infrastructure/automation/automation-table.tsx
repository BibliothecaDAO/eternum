import React, { useMemo, useState } from "react";
import { AutomationOrder, AutomationOrderTemplate, useAutomationStore } from "@/hooks/store/use-automation-store";
import { getStructureName } from "@bibliothecadao/eternum";
import { RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { getIsBlitz } from "@bibliothecadao/eternum";

import Button from "@/ui/design-system/atoms/button";
import { AutomationBackupControls } from "@/ui/features/automation/automation-backup-controls";
import { TemplateAssignmentModal } from "@/ui/features/automation/template-assignment-modal";
import { ETERNUM_CONFIG } from "@/utils/config";

import { AutomationForm } from "./ui/automation-form";
import { AutomationHints } from "./ui/automation-hints";
import { AutomationList } from "./ui/automation-list";
import { CommonAutomations } from "./ui/common-automations";
import type { ResourceOption } from "./model/use-automation-form";
import { buildCommonAutomationPresets } from "./model/common-automations";

interface AutomationTableProps {
  realmEntityId: string;
  realmInfo: RealmInfo;
  availableResources: ResourcesIds[];
}

const eternumConfig = ETERNUM_CONFIG();

const allPossibleResourceIds = Object.entries(ResourcesIds)
  .filter(([, value]) => typeof value === "number")
  .map(([name, id]) => ({ name, id: id as ResourcesIds }));

export const AutomationTable: React.FC<AutomationTableProps> = ({ realmEntityId, realmInfo, availableResources }) => {
  const realmName = useMemo(
    () => (realmInfo ? getStructureName(realmInfo.structure, getIsBlitz()).name : ""),
    [realmInfo],
  );

  const resourceOptions: ResourceOption[] = useMemo(() => {
    if (!realmInfo?.resources) {
      return [];
    }

    return allPossibleResourceIds
      .filter((res) => availableResources.includes(res.id))
      .filter((res) => res.id !== ResourcesIds.Fish && res.id !== ResourcesIds.Wheat)
      .filter((res) => res.id !== ResourcesIds.Labor);
  }, [realmInfo, availableResources]);

  const ordersByRealm = useAutomationStore((state) => state.ordersByRealm);
  const pausedRealms = useAutomationStore((state) => state.pausedRealms);
  const addOrder = useAutomationStore((state) => state.addOrder);
  const updateOrder = useAutomationStore((state) => state.updateOrder);
  const removeOrder = useAutomationStore((state) => state.removeOrder);
  const toggleRealmPause = useAutomationStore((state) => state.toggleRealmPause);

  const ordersForRealm = useMemo(() => ordersByRealm[realmEntityId] || [], [ordersByRealm, realmEntityId]);
  const isRealmPaused = useMemo(() => pausedRealms[realmEntityId] || false, [pausedRealms, realmEntityId]);

  const [editingOrder, setEditingOrder] = useState<AutomationOrder | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateOrders, setTemplateOrders] = useState<AutomationOrderTemplate[]>([]);

  const commonPresets = useMemo(
    () =>
      buildCommonAutomationPresets({
        realmEntityId,
        realmName,
        resourceOptions,
      }),
    [realmEntityId, realmName, resourceOptions],
  );

  if (!realmEntityId || !realmInfo) {
    return <p>Realm data not available.</p>;
  }

  const handleRemoveOrder = (orderId: string) => {
    removeOrder(realmEntityId, orderId);
    if (editingOrder?.id === orderId) {
      setEditingOrder(null);
    }
  };

  const handleCreateOrder = (order: Omit<AutomationOrder, "id" | "producedAmount">) => {
    addOrder(order);
    setEditingOrder(null);
    setShowAddForm(false);
  };

  const handleUpdateOrder = (order: Omit<AutomationOrder, "id" | "producedAmount">) => {
    if (!editingOrder) {
      return;
    }

    const { realmEntityId: orderRealmId, ...orderData } = order;
    updateOrder(orderRealmId, editingOrder.id, orderData);
    setEditingOrder(null);
    setShowAddForm(false);
  };

  const handleFormCancel = () => {
    if (editingOrder) {
      setEditingOrder(null);
    } else {
      setShowAddForm(false);
    }
  };

  const handleTemplateImport = (orders: AutomationOrderTemplate[]) => {
    setTemplateOrders(orders);
    setShowTemplateModal(true);
  };

  const availableRealms = [
    {
      entityId: realmEntityId,
      name: realmName,
    },
  ];

  const isFormVisible = showAddForm || editingOrder !== null;

  return (
    <div className="bord">
      <h4 className="mb-2">
        Automation for Realm {realmName} ({realmEntityId})
      </h4>

      <div className="mb-4">
        <AutomationBackupControls onTemplateImport={handleTemplateImport} />
      </div>

      <div className="flex items-center gap-2 mb-3 p-2 bg-black/20 rounded">
        <input
          type="checkbox"
          id={`pause-realm-${realmEntityId}`}
          checked={isRealmPaused}
          onChange={() => toggleRealmPause(realmEntityId)}
          className="w-4 h-4"
        />
        <label htmlFor={`pause-realm-${realmEntityId}`} className="text-sm font-medium">
          Pause all automation for this realm
        </label>
        {isRealmPaused && <span className="text-red ml-2 text-xs">(PAUSED - No orders will run)</span>}
      </div>

      <AutomationHints visible={showHints} />

      <CommonAutomations
        presets={commonPresets}
        isRealmPaused={isRealmPaused}
        productionRecipes={eternumConfig.resources.productionByComplexRecipe}
        onApply={(orders) => {
          orders.forEach(addOrder);
          setEditingOrder(null);
          setShowAddForm(false);
        }}
      />

      <div className="my-4 flex items-center gap-2">
        {!showAddForm && editingOrder === null && (
          <Button
            onClick={() => {
              setEditingOrder(null);
              setShowAddForm(true);
            }}
            variant="default"
            size="xs"
            disabled={isRealmPaused}
          >
            Add New Automation {isRealmPaused && "(Paused)"}
          </Button>
        )}
        <Button onClick={() => setShowHints(!showHints)} variant="default" size="xs" className="text-gold/70 hover:text-gold">
          {showHints ? "Hide Hints" : "Show Hints"}
        </Button>
      </div>

      {isFormVisible && (
        <AutomationForm
          realmEntityId={realmEntityId}
          realmName={realmName}
          resourceOptions={resourceOptions}
          eternumConfig={eternumConfig}
          initialOrder={editingOrder ?? undefined}
          onSubmit={editingOrder ? handleUpdateOrder : handleCreateOrder}
          onCancel={handleFormCancel}
        />
      )}

      {ordersForRealm.length === 0 ? (
        <p>No automation orders set up for this realm yet.</p>
      ) : (
        <AutomationList
          orders={ordersForRealm}
          isRealmPaused={isRealmPaused}
          eternumConfig={eternumConfig}
          onRemove={handleRemoveOrder}
          onEdit={(order) => {
            setEditingOrder(order);
            setShowAddForm(false);
          }}
        />
      )}

      {showTemplateModal && (
        <TemplateAssignmentModal
          templateOrders={templateOrders}
          availableRealms={availableRealms}
          onClose={() => setShowTemplateModal(false)}
          onAssign={() => {
            setShowTemplateModal(false);
          }}
        />
      )}
    </div>
  );
};
