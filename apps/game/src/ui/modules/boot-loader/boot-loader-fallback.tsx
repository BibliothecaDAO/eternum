import { FirstFrame } from "@/shell/first-frame";

import { useBootDocumentState } from "./boot-loader-state";

/** The app could not start: the first frame stays, never an empty page. */
export const BootLoaderCrashFallback = () => {
  useBootDocumentState("app-ready");
  return <FirstFrame />;
};
