// Type declarations for lucide-react direct icon imports
// lucide-react@0.365.0 doesn't export types for individual icon files

declare module "lucide-react/dist/esm/icons/*" {
  import { LucideIcon } from "lucide-react";
  const icon: LucideIcon;
  export default icon;
}
