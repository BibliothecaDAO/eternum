import React from "react";

import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import {
  AutomationOrder,
  TransferMode,
} from "@/hooks/store/use-automation-store";
import { ResourcesIds } from "@bibliothecadao/types";
import { LucideArrowRight } from "lucide-react";

import { formatMinutes } from "@/shared/lib/time";

interface TransferSummaryProps {
  orders: AutomationOrder[];
  sourceName?: string;
  isPaused: boolean;
  onRemove: (orderId: string) => void;
}

export const TransferSummary: React.FC<TransferSummaryProps> = ({ orders, sourceName, isPaused, onRemove }) => {
  if (orders.length === 0) {
    return <p>No transfer automation orders set up for this entity yet.</p>;
  }

  return (
    <div className={`relative border border-gold/20 rounded-md p-3 ${isPaused ? "opacity-50" : ""}`}>
      {isPaused && (
        <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded">
          <div className="bg-red/90 text-white px-4 py-2 rounded font-bold">AUTOMATION PAUSED</div>
        </div>
      )}
      <table className="w-full text-sm text-left table-auto">
        <thead className="text-xs uppercase /50 text-gold">
          <tr>
            <th scope="col" className="px-6 py-1">
              Destination
            </th>
            <th scope="col" className="px-6 py-1">
              Mode
            </th>
            <th scope="col" className="px-6 py-1">
              Resources
            </th>
            <th scope="col" className="px-6 py-1">
              Schedule
            </th>
            <th scope="col" className="px-6 py-1">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-gold/50">
              <td className="px-6 py-4">
                <div className="flex items-center">
                  <span className="mr-2">{sourceName}</span>
                  <LucideArrowRight className="w-4 h-4" />
                  <span className="ml-2">{order.targetEntityName || order.targetEntityId}</span>
                </div>
              </td>
              <td className="px-6 py-4 capitalize">
                {order.transferMode === TransferMode.Recurring && "Recurring"}
                {order.transferMode === TransferMode.MaintainStock && "Maintain Stock"}
                {order.transferMode === TransferMode.DepletionTransfer && "Depletion"}
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {order.transferResources?.map((resource, idx) => (
                    <div key={`${order.id}-${idx}`} className="flex items-center bg-gold/10 px-2 py-1 rounded">
                      <ResourceIcon resource={ResourcesIds[resource.resourceId]} size="xs" className="mr-1" />
                      <span className="text-xs">{resource.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4 text-xs">
                {order.transferMode === TransferMode.Recurring && `Every ${formatMinutes(order.transferInterval || 60)}`}
                {order.transferMode === TransferMode.MaintainStock &&
                  `When < ${order.transferThreshold?.toLocaleString()}`}
                {order.transferMode === TransferMode.DepletionTransfer &&
                  `When > ${order.transferThreshold?.toLocaleString()}`}
              </td>
              <td className="px-6 py-4">
                <Button onClick={() => onRemove(order.id)} variant="danger" size="xs">
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
