import { EntityResourceTable } from "../resources/EntityResourceTable";
import { ResourceSwap } from "./Swap";

export const BankPanel = () => {
  return (
    <div>
      <div className="p-2">
        <h3>The Bank of Loaf</h3>
      </div>

      <ResourceSwap />

      <EntityResourceTable />
    </div>
  );
};
