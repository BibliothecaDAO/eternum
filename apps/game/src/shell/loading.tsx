import { Icon as SemanticIcon } from "@/ui/design-system/icon";

/** A read still on its way: the kit's turning mark in the place the answer will take. */
export const Loading = () => (
  <div role="status" className="flex justify-center py-6">
    <SemanticIcon name="refresh" size={28} className="animate-spin opacity-70" />
  </div>
);
