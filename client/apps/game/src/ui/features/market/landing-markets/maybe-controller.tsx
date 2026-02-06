import { useMemo } from "react";

import { useControllers } from "@/pm/hooks/controllers/use-controllers";
import { shortAddress } from "@/pm/utils";

export function MaybeController({ address, className, ...props }: { address: string; className?: string }) {
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
}
