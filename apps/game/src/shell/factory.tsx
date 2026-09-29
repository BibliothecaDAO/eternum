import { lazy, Suspense } from "react";

import { useDirectory } from "./herald";
import { Loading, Panel, PanelTitle } from "./kit";
import { ShardUrlForm } from "./shard-url-form";

const FactoryV2Content = lazy(() =>
  import("@/ui/features/factory-v2/components/factory-v2-content").then((module) => ({
    default: module.FactoryV2Content,
  })),
);

/**
 * The operators' page: scheduling slots and seasons, and opening another shard by its URL. The players' lobby names no
 * shard; the directory's shard failures show only here.
 */
export const FactoryPage = () => (
  <div className="space-y-4">
    <Panel>
      <PanelTitle>Open a shard</PanelTitle>
      <OpenShard />
    </Panel>
    <Suspense fallback={<Loading />}>
      <FactoryV2Content />
    </Suspense>
  </div>
);

const OpenShard = () => {
  const directory = useDirectory();
  return <ShardUrlForm failures={directory.data?.failures ?? []} />;
};
