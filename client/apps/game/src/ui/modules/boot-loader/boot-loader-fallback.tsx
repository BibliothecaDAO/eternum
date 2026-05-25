import { useBootDocumentState } from "./boot-loader-state";

export const BootLoaderCrashFallback = () => {
  useBootDocumentState("app-ready");
  return <div />;
};
