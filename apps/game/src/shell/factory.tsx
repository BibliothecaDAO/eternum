import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { fetchLauncherStatus } from "@/ui/features/factory-v2/api/factory-worker";

import { PageFrame } from "./frame/page-frame";
import { useDirectory } from "./herald";
import { Loading } from "./loading";
import { NothingHere } from "./not-found";
import { ShardUrlForm } from "./shard-url-form";
import { APP_STATE_WORDS } from "./words";

const FactoryV2Content = lazy(() =>
  import("@/ui/features/factory-v2/components/factory-v2-content").then((module) => ({
    default: module.FactoryV2Content,
  })),
);

/**
 * The operators' page (spec 15): scheduling seasons, Blitz windows and Eternum games, following launches, and opening
 * another shard by its URL. Only a launcher sees it; a player, signed in or not, gets Nothing here. The launch service
 * answers who launches (the same rule that refuses every write), so the page holds no list of its own.
 */
export const FactoryPage = () => {
  const launcher = useQuery({ queryKey: ["factory", "launcher"], queryFn: fetchLauncherStatus, retry: false });
  return (
    <PageFrame back="/" title={APP_STATE_WORDS.factory}>
      {launcher.isPending ? <Loading /> : launcher.data?.launcher ? <FactoryBody /> : <NothingHere />}
    </PageFrame>
  );
};

const FactoryBody = () => {
  const directory = useDirectory();
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-kit-line bg-kit-plate p-3.5">
        <ShardUrlForm failures={directory.data?.failures ?? []} />
      </section>
      <Suspense fallback={<Loading />}>
        <FactoryV2Content />
      </Suspense>
    </div>
  );
};
