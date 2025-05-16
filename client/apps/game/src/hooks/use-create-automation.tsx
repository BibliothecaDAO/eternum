import { useAutomationStore } from "@/hooks/store/use-automation-store";

export const useCreateAutomation = () => {
  const orders = useAutomationStore((state) => state.ordersByRealm);

  const createAutomation = () => {
    console.log(orders);
  };

  return { createAutomation };
};
