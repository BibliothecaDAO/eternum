import React, { useState } from "react";
import { AutomationOrderTemplate, OrderMode, useAutomationStore } from "../../../hooks/store/use-automation-store";
import Button from "../../design-system/atoms/button";

interface TemplateAssignmentModalProps {
  templateOrders: AutomationOrderTemplate[];
  availableRealms: { entityId: string; name: string }[]; // List of user's realms
  onClose: () => void;
  onAssign: () => void;
}

export const TemplateAssignmentModal: React.FC<TemplateAssignmentModalProps> = ({
  templateOrders,
  availableRealms,
  onClose,
  onAssign,
}) => {
  const [selectedRealm, setSelectedRealm] = useState<string>("");
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const { addOrder } = useAutomationStore();

  const handleToggleOrder = (index: number) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === templateOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(templateOrders.map((_, index) => index)));
    }
  };

  const handleAssign = () => {
    if (!selectedRealm || selectedOrders.size === 0) return;

    // Add selected orders to the selected realm
    selectedOrders.forEach((index) => {
      const templateOrder = templateOrders[index];
      addOrder({
        ...templateOrder,
        realmEntityId: selectedRealm,
        realmName: availableRealms.find((r) => r.entityId === selectedRealm)?.name,
        mode: templateOrder.mode || OrderMode.ProduceOnce,
      });
    });

    onAssign();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black border border-gold/20 rounded-md p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <h2 className="text-lg font-bold mb-4">Assign Template Orders to Realm</h2>

        {/* Realm Selection */}
        <div className="mb-4">
          <label htmlFor="realmSelect" className="block text-sm font-medium mb-2">
            Select Realm
          </label>
          <select
            id="realmSelect"
            value={selectedRealm}
            onChange={(e) => setSelectedRealm(e.target.value)}
            className="w-full px-3 py-2 border border-gold/20 bg-black/20 rounded"
          >
            <option value="">Choose a realm...</option>
            {availableRealms.map((realm) => (
              <option key={realm.entityId} value={realm.entityId}>
                {realm.name} (#{realm.entityId})
              </option>
            ))}
          </select>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-auto mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Template Orders</h3>
            <Button onClick={handleSelectAll} variant="default" size="xs">
              {selectedOrders.size === templateOrders.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="space-y-2">
            {templateOrders.map((order, index) => (
              <div
                key={index}
                className={`p-3 border rounded-md cursor-pointer ${
                  selectedOrders.has(index) ? "border-gold bg-gold/10" : "border-gold/20 hover:border-gold/40"
                }`}
                onClick={() => handleToggleOrder(index)}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(index)}
                    onChange={() => handleToggleOrder(index)}
                    className="h-4 w-4"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <span className="font-medium">Priority: {order.priority}</span>
                      <span className="text-sm text-gold/60">
                        Resource: {order.resourceToUse} | Type: {order.productionType}
                      </span>
                    </div>
                    <div className="text-sm text-gold/50 mt-1">
                      Mode: {order.mode} | Max: {order.maxAmount}
                      {order.bufferPercentage && ` | Buffer: ${order.bufferPercentage}%`}
                    </div>
                    {order.transferMode && (
                      <div className="text-sm text-gold/50">
                        Transfer Mode: {order.transferMode}
                        {order.transferInterval && ` | Interval: ${order.transferInterval}h`}
                        {order.transferThreshold && ` | Threshold: ${order.transferThreshold}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleAssign}
            disabled={!selectedRealm || selectedOrders.size === 0}
            variant="gold"
            size="md"
            className="flex-1"
          >
            Assign {selectedOrders.size} Order{selectedOrders.size !== 1 ? "s" : ""} to Realm
          </Button>
          <Button onClick={onClose} variant="default" size="md" className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Usage example:
 *
 * const [templateOrders, setTemplateOrders] = useState<AutomationOrderTemplate[]>([]);
 * const [showAssignmentModal, setShowAssignmentModal] = useState(false);
 *
 * const handleTemplateImport = (orders: AutomationOrderTemplate[]) => {
 *   setTemplateOrders(orders);
 *   setShowAssignmentModal(true);
 * };
 *
 * // In your component:
 * <AutomationBackupControls onTemplateImport={handleTemplateImport} />
 *
 * {showAssignmentModal && (
 *   <TemplateAssignmentModal
 *     templateOrders={templateOrders}
 *     availableRealms={userRealms} // Get from your realm data
 *     onClose={() => setShowAssignmentModal(false)}
 *     onAssign={() => {
 *       // Handle successful assignment
 *       console.log("Orders assigned!");
 *     }}
 *   />
 * )}
 */
