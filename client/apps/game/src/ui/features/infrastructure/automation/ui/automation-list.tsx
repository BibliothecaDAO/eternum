import React from "react";

import { AutomationOrder } from "@/hooks/store/use-automation-store";

import { AutomationRow } from "./automation-row";

type EternumConfig = ReturnType<typeof import("@/utils/config").ETERNUM_CONFIG>;

interface AutomationListProps {
  orders: AutomationOrder[];
  isRealmPaused: boolean;
  eternumConfig: EternumConfig;
  onRemove: (orderId: string) => void;
  onEdit: (order: AutomationOrder) => void;
}

export const AutomationList: React.FC<AutomationListProps> = ({ orders, isRealmPaused, eternumConfig, onRemove, onEdit }) => {
  return (
    <div className={`relative ${isRealmPaused ? "opacity-50" : ""}`}>
      {isRealmPaused && (
        <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded">
          <div className="bg-red/90 text-white px-4 py-2 rounded font-bold">AUTOMATION PAUSED</div>
        </div>
      )}
      <table className="w-full text-sm text-left table-auto">
        <thead className="text-xs uppercase /50 text-gold">
          <tr>
            <th scope="col" className="px-6 py-3">
              Priority
            </th>
            <th scope="col" className="px-6 py-3">
              Mode
            </th>
            <th scope="col" className="px-6 py-3">
              Resource
            </th>
            <th scope="col" className="px-6 py-3">
              Target/Balance
            </th>
            <th scope="col" className="px-6 py-3">
              Produced
            </th>
            <th scope="col" className="px-6 py-3">
              Type
            </th>
            <th scope="col" className="px-6 py-3">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <AutomationRow key={order.id} order={order} eternumConfig={eternumConfig} onRemove={onRemove} onEdit={onEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
