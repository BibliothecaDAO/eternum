import useUIStore from "../../hooks/store/useUIStore";
import { OSWindow } from "./OSWindow";
import { banks } from "./Config";
import { BankPanel } from "@/components/bank/BankPanel";

export const Banks = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(banks));

  return (
    <OSWindow onClick={() => togglePopup(banks)} show={isOpen} title={banks}>
      {/* COMPONENTS GO HERE */}
      <BankPanel />
    </OSWindow>
  );
};
