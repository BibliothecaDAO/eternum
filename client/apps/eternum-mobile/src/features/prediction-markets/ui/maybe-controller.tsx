import { useMemo } from "react";
import { useControllers } from "@/pm/hooks/controllers/use-controllers";
import { shortAddress } from "@/pm/utils";

interface MaybeControllerProps {
  address: string;
  className?: string;
}

export const MaybeController = ({ address, className, ...props }: MaybeControllerProps) => {
  const { findController } = useControllers();

  const label = useMemo(() => {
    const controller = findController(address);
    if (controller) {
      return `${controller.username} (${shortAddress(address)})`;
    }
    try {
      return shortAddress(address);
    } catch {
      return address;
    }
  }, [address, findController]);

  return (
    <div className={className} {...props}>
      {label}
    </div>
  );
};
